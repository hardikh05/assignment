import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { Customer } from '../models/Customer';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../services/auditService';
import { fireWebhooks } from '../services/webhookService';
import { emitDashboardUpdate } from '../config/socket';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// Parse CSV string into array of objects (RFC 4180-compliant: handles quoted fields with commas, newlines, escaped quotes)
function parseCSV(csvText: string): Record<string, string>[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < csvText.length) {
    const char = csvText[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ("")
        if (i + 1 < csvText.length && csvText[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }
      currentField += char;
      i++;
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
        i++;
      } else if (char === '\r' || char === '\n') {
        // End of row
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        // Skip \r\n pair
        if (char === '\r' && i + 1 < csvText.length && csvText[i + 1] === '\n') {
          i += 2;
        } else {
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    }
  }

  // Push the last field/row
  currentRow.push(currentField.trim());
  if (currentRow.some(f => f !== '')) {
    rows.push(currentRow);
  }

  if (rows.length < 2) return [];

  const headers = rows[0];
  const result: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = rows[r][idx] || ''; });
    result.push(row);
  }
  return result;
}

// Import customers from CSV
router.post('/import', authenticate, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthRequest;
    if (!req.file) return res.status(400).json({ error: 'CSV file is required' });

    const csvText = req.file.buffer.toString('utf-8');
    const rows = parseCSV(csvText);
    if (rows.length === 0) return res.status(400).json({ error: 'CSV file is empty or invalid' });

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process in batches
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const operations = batch.map(row => {
        const name = row.name || row.Name || row.customer_name || '';
        const email = row.email || row.Email || row.customer_email || '';
        const phone = row.phone || row.Phone || row.customer_phone || '';
        const totalSpent = parseFloat(row.totalSpent || row.total_spent || row.TotalSpent || '0') || 0;
        const visits = parseInt(row.visits || row.Visits || '0') || 0;

        if (!name || !email) {
          failed++;
          errors.push(`Row ${i + batch.indexOf(row) + 2}: Missing name or email`);
          return null;
        }

        return {
          updateOne: {
            filter: { email },
            update: { $setOnInsert: { name, email, phone, totalSpent, visits } },
            upsert: true,
          },
        };
      }).filter(Boolean);

      if (operations.length > 0) {
        const result = await Customer.bulkWrite(operations as any[]);
        imported += result.upsertedCount;
        skipped += result.modifiedCount + (operations.length - result.upsertedCount - failed);
      }
    }

    await createAuditLog({
      userId: user!._id.toString(),
      userName: user!.name || user!.email,
      action: 'import',
      entity: 'customer',
      entityId: user!._id.toString(),
      entityName: `CSV Import (${imported} customers)`,
      metadata: { imported, skipped, failed, totalRows: rows.length },
      ipAddress: req.ip,
    });

    emitDashboardUpdate({ type: 'customers:imported', count: imported });
    fireWebhooks('customer.created', { imported, total: rows.length });

    res.json({ imported, skipped, failed, total: rows.length, errors: errors.slice(0, 10) });
  } catch (error) {
    next(error);
  }
});

// Export customers to CSV
router.get('/export', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter: any = {};
    if (req.query.minSpent) filter.totalSpent = { $gte: parseFloat(req.query.minSpent as string) };
    if (req.query.maxSpent) filter.totalSpent = { ...filter.totalSpent, $lte: parseFloat(req.query.maxSpent as string) };
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const customers = await Customer.find(filter).sort({ createdAt: -1 }).lean();

    // Build CSV
    const headers = ['Name', 'Email', 'Phone', 'Total Spent', 'Visits', 'Created At'];
    const csvRows = [headers.join(',')];
    for (const c of customers) {
      csvRows.push([
        `"${c.name}"`,
        `"${c.email}"`,
        `"${c.phone || ''}"`,
        c.totalSpent,
        c.visits,
        `"${c.createdAt?.toISOString() || ''}"`,
      ].join(','));
    }

    const { user } = req as AuthRequest;
    await createAuditLog({
      userId: user!._id.toString(),
      userName: user!.name || user!.email,
      action: 'export',
      entity: 'customer',
      entityId: user!._id.toString(),
      entityName: `CSV Export (${customers.length} customers)`,
      ipAddress: req.ip,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=customers.csv');
    res.send(csvRows.join('\n'));
  } catch (error) {
    next(error);
  }
});

export default router;

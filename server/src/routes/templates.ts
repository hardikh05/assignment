import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { EmailTemplate } from '../models/EmailTemplate';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get all templates
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthRequest;
    const templates = await EmailTemplate.find({ userId: user!._id })
      .select('-jsonDesign -htmlContent')
      .sort({ updatedAt: -1 });
    res.json({ templates });
  } catch (error) {
    next(error);
  }
});

// Get template by ID (full content)
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthRequest;
    const template = await EmailTemplate.findOne({ _id: req.params.id, userId: user!._id });
    if (!template) throw new AppError('Template not found', 404);
    res.json(template);
  } catch (error) {
    next(error);
  }
});

// Create template
router.post(
  '/',
  authenticate,
  [body('name').trim().notEmpty()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError('Validation failed', 400);

      const { user } = req as AuthRequest;
      const template = await EmailTemplate.create({ ...req.body, userId: user!._id });
      res.status(201).json(template);
    } catch (error) {
      next(error);
    }
  }
);

// Update template
router.put('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthRequest;
    const template = await EmailTemplate.findOneAndUpdate(
      { _id: req.params.id, userId: user!._id },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!template) throw new AppError('Template not found', 404);
    res.json(template);
  } catch (error) {
    next(error);
  }
});

// Delete template
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthRequest;
    const template = await EmailTemplate.findOneAndDelete({ _id: req.params.id, userId: user!._id });
    if (!template) throw new AppError('Template not found', 404);
    res.json({ message: 'Template deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;

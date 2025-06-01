import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/User';

export const setupPassport = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackURL: `${process.env.API_URL || 'http://localhost:5000'}/api/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // First try to find user by Google ID
          let user = await User.findOne({ googleId: profile.id });

          if (!user) {
            // If not found by Google ID, try to find by email
            user = await User.findOne({ email: profile.emails?.[0].value });

            if (user) {
              // If user exists with email but no Google ID, update with Google ID
              user.googleId = profile.id;
              user.avatar = profile.photos?.[0].value;
              await user.save();
            } else {
              // Create new user if doesn't exist
              user = await User.create({
                googleId: profile.id,
                email: profile.emails?.[0].value,
                name: profile.displayName,
                avatar: profile.photos?.[0].value,
              });
            }
          }

          return done(null, user);
        } catch (error) {
          console.error('Google OAuth error:', error);
          return done(error as Error);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
}; 
# Local Development Setup Guide

## Google OAuth Configuration for Local Development

When running the app locally with `./run.sh`, you need to configure Google OAuth correctly.

### Port Configuration

- **Backend**: `http://localhost:8080`
- **Frontend**: `http://localhost:5173`
- **OAuth Redirect**: `http://localhost:8080/auth/google/callback`

### Step 1: Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your OAuth 2.0 Client ID
3. Add **Authorized redirect URIs**:
   - For local dev: `http://localhost:8080/auth/google/callback`
   - For Docker: `http://localhost:3000/auth/google/callback`
4. Add **Authorized JavaScript origins**:
   - `http://localhost:8080` (for local dev)
   - `http://localhost:3000` (for Docker)

**Important**: You can add multiple redirect URIs in Google Cloud Console, so add both:
- `http://localhost:8080/auth/google/callback` (for `./run.sh`)
- `http://localhost:3000/auth/google/callback` (for Docker)

### Step 2: Create `.env.local` File

Create a `.env.local` file in the project root:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with your actual credentials:

```env
# Google OAuth (REQUIRED)
GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-actual-client-secret
GOOGLE_REDIRECT_URL=http://localhost:8080/auth/google/callback

# JWT Secret (REQUIRED)
JWT_SECRET=your-very-secure-random-secret-key-min-32-characters

# Frontend URL (optional - defaults to http://localhost:5173)
FRONTEND_URL=http://localhost:5173
```

### Step 3: Run the Application

```bash
./run.sh
```

The script will:
1. Run tests
2. Load environment variables from `.env.local`
3. Start backend on port 8080
4. Start frontend on port 5173

### How It Works

1. User clicks "Sign in with Google" on `http://localhost:5173`
2. Frontend redirects to `http://localhost:8080/auth/google`
3. Backend redirects to Google OAuth
4. Google redirects back to `http://localhost:8080/auth/google/callback`
5. Backend processes the callback and sets a session cookie
6. Backend redirects to `http://localhost:5173/` (frontend)

### Troubleshooting

#### Issue: "OAuth client was not found" or "invalid_client"

**Solution**:
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local` are correct
- Make sure the redirect URI in Google Cloud Console matches: `http://localhost:8080/auth/google/callback`
- Restart the backend after updating `.env.local`

#### Issue: Redirect URI mismatch

**Solution**:
- In Google Cloud Console, ensure you have BOTH redirect URIs:
  - `http://localhost:8080/auth/google/callback` (for local dev)
  - `http://localhost:3000/auth/google/callback` (for Docker)
- Check for typos, extra spaces, or wrong port numbers
- Use `http://` not `https://` for localhost

#### Issue: Not redirecting back to frontend

**Solution**:
- Check that `FRONTEND_URL` is set to `http://localhost:5173` in `.env.local`
- The backend should redirect to `FRONTEND_URL + "/"` after OAuth callback
- Check browser console for any errors

#### Issue: Environment variables not loading

**Solution**:
- Make sure `.env.local` is in the project root (same directory as `run.sh`)
- Check that variables don't have quotes around values in `.env.local`
- Restart the backend after changing `.env.local`

### Verification

After setting up, verify:

1. **Check environment variables are loaded**:
   ```bash
   # While backend is running, check the logs
   # You should see the FRONTEND_URL and GOOGLE_REDIRECT_URL printed
   ```

2. **Test OAuth flow**:
   - Open `http://localhost:5173`
   - Click "Sign in with Google"
   - Should redirect to Google login
   - After login, should redirect back to `http://localhost:5173`

3. **Check backend logs**:
   - Look for any OAuth-related errors
   - Verify the redirect URL being used

### Differences: Local Dev vs Docker

| Setting | Local Dev (`./run.sh`) | Docker (`docker-compose`) |
|---------|------------------------|---------------------------|
| Backend Port | 8080 | 8080 (mapped to 3000 on host) |
| Frontend Port | 5173 | 3000 (served by backend) |
| OAuth Redirect | `http://localhost:8080/auth/google/callback` | `http://localhost:3000/auth/google/callback` |
| Frontend URL | `http://localhost:5173` | `http://localhost:3000` |
| Config File | `.env.local` | `.env` |

### Quick Reference

**For Local Development**:
- Backend: `http://localhost:8080`
- Frontend: `http://localhost:5173`
- OAuth Redirect: `http://localhost:8080/auth/google/callback`
- Config: `.env.local`

**For Docker**:
- Backend: `http://localhost:3000` (maps to 8080 in container)
- Frontend: `http://localhost:3000` (served by backend)
- OAuth Redirect: `http://localhost:3000/auth/google/callback`
- Config: `.env`





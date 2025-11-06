# Microsoft OAuth Setup Guide

This guide will help you set up Microsoft OAuth authentication for the NexOrg mobile application.

## Prerequisites
- An Azure account (create one at https://portal.azure.com)
- Access to Azure Active Directory

## Step 1: Register Your App in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Fill in the details:
   - **Name**: NexOrg Mobile Application
   - **Supported account types**: Choose one:
     - "Accounts in any organizational directory and personal Microsoft accounts" (recommended for most apps)
     - Or select based on your requirements
   - **Redirect URI**: Leave blank for now (we'll add it later)
5. Click **Register**

## Step 2: Get Your Client ID

1. After registration, you'll see the **Overview** page
2. Copy the **Application (client) ID** - this is your `EXPO_PUBLIC_MICROSOFT_CLIENT_ID`
3. Copy the **Directory (tenant) ID** - this is your `EXPO_PUBLIC_MICROSOFT_TENANT_ID`
   - If you selected "Accounts in any organizational directory and personal Microsoft accounts", you can use `common` instead

## Step 3: Configure Redirect URIs

1. In your app registration, go to **Authentication** in the left sidebar
2. Click **Add a platform** > **Mobile and desktop applications**
3. Add the following redirect URIs:
   ```
   nexorgmobileapplication://auth/callback
   ```
4. Also add for local development:
   ```
   exp://localhost:8081/--/auth/callback
   ```
5. Under **Advanced settings**, enable:
   - ✅ Access tokens
   - ✅ ID tokens
6. Click **Save**

## Step 4: Configure API Permissions

1. Go to **API permissions** in the left sidebar
2. Click **Add a permission** > **Microsoft Graph**
3. Select **Delegated permissions**
4. Add the following permissions:
   - `openid`
   - `profile`
   - `email`
   - `User.Read`
5. Click **Add permissions**
6. (Optional) Click **Grant admin consent** if you have admin rights

## Step 5: Configure Your App

1. Create a `.env` file in the `NexOrg` directory (copy from `.env.example`)
2. Add your credentials:
   ```env
   EXPO_PUBLIC_MICROSOFT_CLIENT_ID=your_client_id_from_step_2
   EXPO_PUBLIC_MICROSOFT_TENANT_ID=common
   ```

## Step 6: Update app.json

The redirect URI scheme is already configured in your `app.json`:
```json
"scheme": "nexorgmobileapplication"
```

## Step 7: Rebuild Your Development Client

Since we've added OAuth functionality, rebuild your development client:

```bash
eas build --profile development --platform android
```

## Step 8: Test the Integration

1. Start your development server:
   ```bash
   npx expo start --dev-client
   ```

2. Open the app on your phone
3. Navigate to the auth screen
4. Click "Continue with Microsoft"
5. Sign in with your Microsoft account
6. Grant permissions when prompted
7. You should be redirected back to the app

## Troubleshooting

### "Invalid redirect URI" error
- Make sure the redirect URI in Azure Portal exactly matches: `nexorgmobileapplication://auth/callback`
- Ensure the scheme in `app.json` is `nexorgmobileapplication`

### "Client ID not found" error
- Verify your `.env` file has the correct `EXPO_PUBLIC_MICROSOFT_CLIENT_ID`
- Restart your development server after adding environment variables

### "Permissions not granted" error
- Go back to Azure Portal > API permissions
- Click "Grant admin consent for [your organization]"

### App doesn't redirect back after sign-in
- Rebuild your development client with `eas build`
- Make sure you're using the development build, not Expo Go

## Security Best Practices

1. **Never commit your `.env` file** - it's already in `.gitignore`
2. **Use different client IDs** for development and production
3. **Limit API permissions** to only what you need
4. **Enable multi-factor authentication** for admin accounts
5. **Regularly review** app permissions and access logs in Azure Portal

## Additional Resources

- [Microsoft Identity Platform Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- [Expo AuthSession Documentation](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/overview)

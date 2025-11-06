import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// Enable browser session to be dismissed properly
WebBrowser.maybeCompleteAuthSession();

// Microsoft OAuth Configuration
export const microsoftConfig = {
  // You'll need to replace these with your Azure AD app credentials
  clientId: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID || 'YOUR_MICROSOFT_CLIENT_ID',
  tenantId: process.env.EXPO_PUBLIC_MICROSOFT_TENANT_ID || 'common', // 'common' allows any Microsoft account
  
  // OAuth endpoints
  authorizationEndpoint: `https://login.microsoftonline.com/${process.env.EXPO_PUBLIC_MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${process.env.EXPO_PUBLIC_MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/token`,
  
  // Scopes - what information you want to access
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};

// Create the redirect URI for your app
export const getRedirectUri = () => {
  return AuthSession.makeRedirectUri({
    scheme: 'nexorgmobileapplication',
    path: 'auth/callback'
  });
};

// Discovery document for Microsoft OAuth
export const discovery = {
  authorizationEndpoint: microsoftConfig.authorizationEndpoint,
  tokenEndpoint: microsoftConfig.tokenEndpoint,
};

# Firebase Analytics & Crashlytics Setup

This document explains the Firebase Analytics and Crashlytics implementation in the HomeCare app.

## 📦 Installed Packages

- `@react-native-firebase/app` - Core Firebase SDK
- `@react-native-firebase/analytics` - Firebase Analytics
- `@react-native-firebase/crashlytics` - Firebase Crashlytics

## 🔧 Configuration

### 1. Firebase Project Setup
- Firebase project is already configured with `google-services.json`
- Analytics and Crashlytics are enabled in the Firebase console

### 2. App Configuration
- `app.json` includes the necessary Firebase plugins
- `google-services.json` is properly configured for Android

## 📊 Analytics Implementation

### Screen Tracking
All screens automatically track views:
- `HomeScreen` → "Home" event
- `CreateScreen` → "Create" event  
- `HistoryScreen` → "History" event
- `DayDetailsScreen` → "DayDetails" event

### Custom Events
The app tracks important user actions:

#### Caregiver Actions
- `caregiver_action` - When caregivers are created, assigned, or unassigned
- `caregiver_added` - When a new caregiver is added to the system

#### Payment Actions
- `payment_action` - When payments are completed
- `payment_marked` - When a payment is marked as paid

#### Calendar Interactions
- `calendar_interaction` - When users interact with the calendar (add/remove caregivers)

### User Properties
- `app_version` - Current app version
- `platform` - "mobile"

## 🚨 Crashlytics Implementation

### Error Boundary
- Catches React component errors
- Automatically reports to Crashlytics
- Shows user-friendly error screen
- Includes retry functionality

### Custom Error Logging
- All Firebase service errors are logged
- Context information is included with errors
- User actions are logged for debugging

### User Identification
- User ID can be set for better error tracking
- Custom attributes can be added for debugging

## 🛠 Usage Examples

### Analytics
```typescript
import { AnalyticsService } from '@/services/firebase';

// Track custom event
AnalyticsService.trackEvent('button_clicked', {
  button_name: 'save_caregiver',
  screen: 'create'
});

// Track caregiver action
AnalyticsService.trackCaregiverAction('created', 'caregiver_123', 'Maria Souza');

// Track payment
AnalyticsService.trackPaymentAction('completed', 100, 'Diário', 'caregiver_123');
```

### Crashlytics
```typescript
import { CrashlyticsService } from '@/services/firebase';

// Log custom message
CrashlyticsService.log('User completed payment flow');

// Log error
try {
  // Some operation
} catch (error) {
  CrashlyticsService.logError(error, 'Payment processing failed');
}

// Set user ID
CrashlyticsService.setUserId('user_123');

// Set custom attributes
CrashlyticsService.setAttribute('user_type', 'premium');
```

## 📱 Development vs Production

### Development Mode
- Error messages are shown in the error boundary
- Console warnings for Firebase failures
- Analytics collection is enabled

### Production Mode
- User-friendly error messages only
- All errors are reported to Crashlytics
- Analytics data is collected for insights

## 🔍 Firebase Console

### Analytics Dashboard
View user behavior, screen views, and custom events:
1. Go to Firebase Console → Analytics → Events
2. Check real-time and historical data
3. Create custom reports for business insights

### Crashlytics Dashboard
Monitor app stability and errors:
1. Go to Firebase Console → Crashlytics
2. View crash reports and non-fatal errors
3. Set up alerts for critical issues

## 🚀 Next Steps

1. **Test the implementation** by using the app and checking Firebase console
2. **Set up custom dashboards** in Firebase Analytics
3. **Configure alerts** in Crashlytics for critical errors
4. **Add more custom events** as needed for business insights
5. **Set up user segmentation** based on usage patterns

## 📋 Event Reference

### Automatic Events
- Screen views for all screens
- App lifecycle events
- User engagement metrics

### Custom Events
- `caregiver_action` - Caregiver management actions
- `payment_action` - Payment-related actions
- `calendar_interaction` - Calendar usage
- `caregiver_added` - New caregiver creation
- `payment_marked` - Payment completion

### User Properties
- `app_version` - App version tracking
- `platform` - Platform identification
- `user_type` - User classification (can be added)

This implementation provides comprehensive analytics and crash reporting to help monitor app health and user behavior.

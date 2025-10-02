# Firestore Implementation Guide

This document explains the complete Firestore implementation in the HomeCare app with real-time listeners and offline support.

## 🚀 Overview

The app now uses Firebase Firestore as the primary database with real-time synchronization, while maintaining local state as a fallback for offline scenarios.

## 📦 Packages Installed

- `@react-native-firebase/firestore` - Firestore database
- `@react-native-firebase/app` - Core Firebase SDK
- `@react-native-firebase/analytics` - Analytics tracking
- `@react-native-firebase/crashlytics` - Crash reporting

## 🏗️ Architecture

### Real-time Listeners Pattern

Following the Firebase documentation pattern:

```typescript
function onResult(QuerySnapshot) {
  console.log('Got Users collection result.');
}

function onError(error) {
  console.error(error);
}

firestore().collection('Users').onSnapshot(onResult, onError);
```

### Service Layer (`src/services/firestore.ts`)

**FirestoreService** provides:
- Real-time listeners for all collections
- CRUD operations with error handling
- Offline fallback support
- Automatic cleanup of listeners

### Context Layer (`src/context/ScheduleContext.tsx`)

**ScheduleContext** manages:
- Local state (fallback)
- Firestore connection status
- Real-time data synchronization
- Loading states

## 📊 Database Structure

### Collections

1. **`caregivers`** - Caregiver profiles
2. **`schedule`** - Daily caregiver assignments
3. **`payments`** - Payment tracking (single document)
4. **`paymentHistory`** - Payment history records

### Document Structure

#### Caregivers Collection
```typescript
{
  id: string;
  name: string;
  frequency: 'Diário' | 'Semanal' | 'Mensal';
  amount: number;
  createdAt: string;
  updatedAt: string;
}
```

#### Schedule Collection
```typescript
{
  [dateKey: string]: {
    caregiverIds: string[];
    updatedAt: string;
  }
}
```

#### Payments Document (main)
```typescript
{
  daily: { [caregiverId: string]: string[] };
  weekly: { [caregiverId: string]: string[] };
  monthly: { [caregiverId: string]: string[] };
  updatedAt: string;
}
```

#### Payment History Collection
```typescript
{
  id: string;
  caregiverId: string;
  caregiverName: string;
  date: string;
  frequency: 'Diário' | 'Semanal' | 'Mensal';
  description: string;
  amount: number;
  paidAt: string;
  createdAt: string;
}
```

## 🔄 Real-time Synchronization

### Listeners Setup

```typescript
// Caregivers
const unsubscribeCaregivers = FirestoreService.subscribeToCaregivers(
  (caregivers) => {
    setCaregivers(caregivers);
  },
  (error) => {
    setIsFirestoreConnected(false);
  }
);

// Schedule
const unsubscribeSchedule = FirestoreService.subscribeToSchedule(
  (schedule) => {
    const scheduleWithSets = convertToSets(schedule);
    setScheduleByDay(scheduleWithSets);
  },
  (error) => {
    setIsFirestoreConnected(false);
  }
);

// Payments
const unsubscribePayments = FirestoreService.subscribeToPayments(
  (payments) => {
    setPayments(payments);
  },
  (error) => {
    setIsFirestoreConnected(false);
  }
);

// Payment History
const unsubscribePaymentHistory = FirestoreService.subscribeToPaymentHistory(
  (history) => {
    setPaymentHistory(history);
  },
  (error) => {
    setIsFirestoreConnected(false);
  }
);
```

### Automatic Cleanup

```typescript
useEffect(() => {
  // Setup listeners
  
  return () => {
    unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    FirestoreService.cleanup();
  };
}, []);
```

## 🔄 Data Flow

### 1. App Initialization
```
App Start → Firebase Init → Firestore Init → Real-time Listeners → Data Sync
```

### 2. User Actions
```
User Action → Context Function → Firestore Update → Real-time Listener → UI Update
```

### 3. Offline Handling
```
Network Error → Fallback to Local State → Show Offline Indicator → Retry on Reconnect
```

## 🛡️ Error Handling & Offline Support

### Connection Status
- `isFirestoreConnected` - Tracks Firestore connection
- `isLoading` - Shows loading state during initialization
- Connection status indicator in UI

### Fallback Strategy
```typescript
const addCaregiver = useCallback(async (caregiver) => {
  try {
    if (isFirestoreConnected) {
      // Use Firestore
      await FirestoreService.addCaregiver(caregiver);
    } else {
      // Fallback to local state
      setCaregivers(prev => [...prev, newCaregiver]);
    }
  } catch (error) {
    // Always fallback on error
    setCaregivers(prev => [...prev, newCaregiver]);
  }
}, [isFirestoreConnected]);
```

### Error Reporting
- All Firestore errors logged to Crashlytics
- User-friendly error messages
- Automatic retry mechanisms

## 🎯 Key Features

### Real-time Updates
- Changes sync across all devices instantly
- No manual refresh needed
- Optimistic updates for better UX

### Offline Support
- App works without internet connection
- Data persists locally
- Syncs when connection restored

### Data Consistency
- Single source of truth (Firestore)
- Local state as cache/fallback
- Conflict resolution handled automatically

### Performance
- Efficient listeners with proper cleanup
- Minimal re-renders with useCallback
- Optimized queries and indexes

## 🔧 Configuration

### App.json
```json
{
  "plugins": [
    "@react-native-firebase/app",
    "@react-native-firebase/analytics",
    "@react-native-firebase/crashlytics",
    "@react-native-firebase/firestore"
  ]
}
```

### Firebase Console Setup
1. Enable Firestore Database
2. Set up security rules
3. Configure indexes for queries
4. Set up backup policies

## 📱 User Experience

### Loading States
- Loading screen during initialization
- Smooth transitions between online/offline
- Connection status indicator

### Error States
- Graceful error handling
- User-friendly error messages
- Automatic retry mechanisms

### Offline Experience
- App remains functional offline
- Clear offline indicators
- Data syncs when online

## 🚀 Benefits

### For Users
- Real-time collaboration
- Offline functionality
- Reliable data persistence
- Fast, responsive interface

### For Developers
- Simplified state management
- Automatic synchronization
- Built-in error handling
- Scalable architecture

### For Business
- Multi-device support
- Data backup and recovery
- Analytics and insights
- Cost-effective scaling

## 🔍 Monitoring & Debugging

### Console Logs
- Connection status updates
- Data synchronization events
- Error tracking and reporting

### Firebase Console
- Real-time database monitoring
- Query performance insights
- Error tracking and analytics

### Crashlytics Integration
- Automatic error reporting
- User context preservation
- Performance monitoring

## 📋 Next Steps

1. **Security Rules** - Implement proper Firestore security rules
2. **Data Validation** - Add client-side validation
3. **Caching Strategy** - Implement advanced caching
4. **Performance Optimization** - Add query optimization
5. **Testing** - Add comprehensive test coverage

This implementation provides a robust, scalable foundation for the HomeCare app with real-time synchronization and offline support.

package homecare.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

import com.reactnativeandroidwidget.RNWidgetProvider;

import java.util.Calendar;

public class HomeCareWidgetProvider extends RNWidgetProvider {
    private static final String REFRESH_DATE = "homecare.REFRESH_WIDGET_DATE";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        super.onUpdate(context, manager, widgetIds);
        if (widgetIds.length == 0) return;

        Calendar midnight = Calendar.getInstance();
        midnight.add(Calendar.DATE, 1);
        midnight.set(Calendar.HOUR_OF_DAY, 0);
        midnight.set(Calendar.MINUTE, 0);
        midnight.set(Calendar.SECOND, 0);
        midnight.set(Calendar.MILLISECOND, 0);

        // Inexact: no special alarm permission; Android may defer delivery in power-saving modes.
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, midnight.getTimeInMillis(), dateUpdate(context));
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (REFRESH_DATE.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)
                || Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            onUpdate(context, manager, manager.getAppWidgetIds(new ComponentName(context, getClass())));
            return;
        }
        super.onReceive(context, intent);
    }

    @Override
    public void onDisabled(Context context) {
        super.onDisabled(context);
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        alarms.cancel(dateUpdate(context));
    }

    private PendingIntent dateUpdate(Context context) {
        Intent intent = new Intent(context, getClass()).setAction(REFRESH_DATE);
        return PendingIntent.getBroadcast(context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}

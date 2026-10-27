import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { renderHomeWidget } from "./HomeWidgets";
import { readWidgetSnapshot } from "./widgetStorage";

// Runs headless (app may be closed): redraw from the last snapshot the app saved.
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetAction === "WIDGET_DELETED" || props.widgetAction === "WIDGET_CLICK") return;
  props.renderWidget(renderHomeWidget(props.widgetInfo.widgetName, await readWidgetSnapshot()));
}

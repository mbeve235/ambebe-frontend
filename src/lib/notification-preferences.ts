export const notifyNotificationPreferenceChanged = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("ambebe-notification-preference-changed"));
};

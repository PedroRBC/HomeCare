const { AndroidConfig, withAndroidManifest, withInfoPlist } = require("@expo/config-plugins");

const PRIVACY_METADATA = {
  "com.facebook.sdk.AutoInitEnabled": "false",
  "com.facebook.sdk.AutoLogAppEventsEnabled": "false",
  "com.facebook.sdk.AdvertiserIDCollectionEnabled": "false",
};

const withFacebookPrivacy = (config) => {
  config = withAndroidManifest(config, (modConfig) => {
    let application = AndroidConfig.Manifest.getMainApplicationOrThrow(modConfig.modResults);
    for (const [name, value] of Object.entries(PRIVACY_METADATA)) {
      application = AndroidConfig.Manifest.addMetaDataItemToMainApplication(
        application,
        name,
        value,
      );
    }
    return modConfig;
  });

  return withInfoPlist(config, (modConfig) => {
    modConfig.modResults = {
      ...modConfig.modResults,
      FacebookAutoInitEnabled: false,
      FacebookAutoLogAppEventsEnabled: false,
      FacebookAdvertiserIDCollectionEnabled: false,
    };
    return modConfig;
  });
};

module.exports = withFacebookPrivacy;

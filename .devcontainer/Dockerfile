FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

ARG ANDROID_CMDLINE_TOOLS_VERSION=13114758
ARG BUN_VERSION=1.2.15

USER root

ENV DEBIAN_FRONTEND=noninteractive \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    ANDROID_HOME=/opt/android-sdk \
    JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
    GRADLE_USER_HOME=/home/node/.gradle \
    BUN_INSTALL=/home/node/.bun

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        lib32stdc++6 \
        lib32z1 \
        openjdk-17-jdk-headless \
        unzip \
        zip \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p "${ANDROID_SDK_ROOT}/cmdline-tools" \
    && curl -fsSL \
        "https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_CMDLINE_TOOLS_VERSION}_latest.zip" \
        -o /tmp/android-command-line-tools.zip \
    && unzip -q /tmp/android-command-line-tools.zip -d /tmp/android-command-line-tools \
    && mv /tmp/android-command-line-tools/cmdline-tools "${ANDROID_SDK_ROOT}/cmdline-tools/latest" \
    && rm -rf /tmp/android-command-line-tools /tmp/android-command-line-tools.zip

ENV PATH="${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools:${ANDROID_SDK_ROOT}/emulator:${BUN_INSTALL}/bin:${PATH}"

RUN yes | sdkmanager --sdk_root="${ANDROID_SDK_ROOT}" --licenses >/dev/null \
    && sdkmanager --sdk_root="${ANDROID_SDK_ROOT}" \
        "build-tools;35.0.0" \
        "build-tools;36.0.0" \
        "cmake;3.22.1" \
        "cmake;3.30.5" \
        "ndk;27.1.12297006" \
        "platform-tools" \
        "platforms;android-35" \
        "platforms;android-36"

RUN mkdir -p "${GRADLE_USER_HOME}" "/home/node/.bun" \
    && chown -R node:node "${ANDROID_SDK_ROOT}" "${GRADLE_USER_HOME}" "/home/node/.bun"

USER node

RUN curl -fsSL https://bun.sh/install | bash -s -- "bun-v${BUN_VERSION}"

USER root

RUN npm install --global "eas-cli@16.19.3" \
    && chown -R node:node /usr/local/lib/node_modules /usr/local/bin

USER node

WORKDIR /workspaces/homecare

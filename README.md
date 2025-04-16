# bourso-desktop

![main screen](https://github.com/user-attachments/assets/9d2a43dc-c56a-435e-84b4-b26a2db2c541)

This app is a desktop client for [BoursoBank/Boursorama](https://www.boursorama.com/). It features a simple and clean interface to manage your accounts, place orders, and setup automatic DCA (Dollar Cost Averaging) on your favorite assets.

- [Install](#install)
- [Features](#features)
- [Known limitations](#known-limitations)
- [Known issues](#known-issues)
- [Security](#security)
- [Disclaimer](#disclaimer)

## Install
### Download the latest release
Head over https://github.com/azerpas/bourso-desktop/releases and download the latest release for your platform.
- Windows ends with `_x64-setup.exe`
- MacOS
  - Intel (pre-2020) ends with `_x64.dmg`
  - Apple Silicon (2020+) ends with `_aarch64.dmg`
- Linux has multiple options
### Build from source
Or you can build the app from source. Requires pnpm and [Tauri system dependencies](https://v2.tauri.app/start/prerequisites/#system-dependencies).
```
git clone https://github.com/azerpas/bourso-desktop.git
cd bourso-desktop
pnpm install
pnpm tauri build
```

## Getting started
Head over to [the documentation](./docs/getting_started.md) to get started with the app.

### MacOS specific
On MacOS, you may need to allow the app to run

Make sure you move the app to your Applications folder before running it.

Then run the following command in your terminal:
```
xattr -r -d com.apple.quarantine /Applications/bourso-desktop.app
```

## Features

- [x] Assets charts
- [x] Accounts balance
- [x] Place an order
- [X] Setup automatic DCA
  - Platforms
    - [X] MacOS
    - [ ] Windows
    - [X] Linux *untested*
  - [X] Passwordless
  - [X] Password 
- [X] MFA/2FA handling
- Supply chain security
  - [ ] [SLSA](https://slsa.dev/)
  - [ ] [OpenSSF Scorecard](https://github.com/ossf/scorecard-action)
- [ ] Portfolio performance
  - [ ] Chart
  - [ ] Stats (ROI, ...)
- [ ] Inner account transfer
- [ ] Dark mode
- [ ] DCA: remind me in ...

## Known limitations
- [ ] Limited dashboard chart features
- [ ] Limited order types
- [ ] Limited order history

## Known issues
- [ ] Windows support is not fully implemented (no DCA)
- [ ] Error handling could be improved
- [X] ~~Passwordless DCA opens up multiple windows until the user has logged in and confirmed the DCA~~
- [ ] No internet connection handling
- [ ] Cookie has expired


## Security

This app runs locally. All outbound/inbound data is sent/received to/from BoursoBank servers only. Your password will not be saved locally unless you check the `Save password` option, otherwise it will be asked each time you run the app. Your client ID has to be set once and will be saved into the app data for next usages.

## Disclaimer

**IMPORTANT: PLEASE READ THIS DISCLAIMER CAREFULLY BEFORE USING THIS APPLICATION.**

This application (the "bourso-desktop App") is an open-source tool designed to communicate with Boursorama/Boursobank services, enabling automated API calls from your desktop. By using this bourso-desktop App, you acknowledge and agree to the following terms:

1. **No Affiliation**: This bourso-desktop App is not affiliated with, endorsed by, or sponsored by BoursoBank or any bank or financial institution. It is developed and maintained by independent contributors.

2. **Use at Your Own Risk**: The bourso-desktop App is provided "as is," without warranty of any kind, either express or implied. The developers and contributors shall not be held liable for any direct, indirect, incidental, special, consequential, or punitive damages arising out of the use of or inability to use the bourso-desktop App, even if advised of the possibility of such damages.

3. **Security**: While efforts have been made to ensure the security of the bourso-desktop App, using it may expose you to risks, including but not limited to data breaches, unauthorized access, and financial loss. It is your responsibility to implement appropriate security measures and monitor your bank accounts for any unauthorized activity.

4. **Compliance**: You are responsible for ensuring that your use of the bourso-desktop App complies with all applicable laws, regulations, and terms of service of your bank. The developers and contributors are not responsible for any legal or regulatory violations that may arise from your use of the bourso-desktop App.

5. **No Financial Advice**: The bourso-desktop App does not provide financial advice. Any actions taken based on the information or functionality provided by the bourso-desktop App are your sole responsibility.

6. **Open Source**: This bourso-desktop App is open-source, and its code is available for review and modification. However, the developers and contributors are not obligated to provide support, updates, or maintenance for the bourso-desktop App.

7. **Third-Party Services**: The bourso-desktop App may interact with third-party services and APIs. The developers and contributors are not responsible for the availability, reliability, or security of these services.

By using this bourso-desktop App, you acknowledge that you have read, understood, and agreed to this disclaimer. If you do not agree to these terms, do not use the bourso-desktop App.

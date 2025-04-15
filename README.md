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
Head over https://github.com/azerpas/bourso-desktop/releases and download the latest release for your platform.
- Windows ends with `_x64-setup.exe`
- MacOS
  - Intel (pre-2020) ends with `_x64.dmg`
  - Apple Silicon (2020+) ends with `_aarch64.dmg`
- Linux has multiple options

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
- [ ] Passwordless DCA opens up multiple windows until the user has logged in and confirmed the DCA
- [ ] No internet connection handling
- [ ] Cookie has expired


## Security

This app runs locally. All outbound/inbound data is sent/received to/from BoursoBank servers only. Your password will not be saved locally unless you check the `Save password` option, otherwise it will be asked each time you run the app. Your client ID has to be set once and will be saved into the app data for next usages.

## Disclaimer

This script is provided as is, without any warranty. I am not responsible for any loss of funds. Use at your own risk. I am not affiliated with BoursoBank or any other project mentioned in this repository. This is not financial advice. 
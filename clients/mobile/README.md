# DarijaTranslator: Windows + physical iPhone (Expo Go)

## Launch

Install Expo Go compatible with this project's SDK 58. Check the installed
app's SDK support using [Expo's download page](https://expo.dev/go).
Physical iPhones generally cannot install old Expo Go versions; if a version
mismatch appears, check Expo Go's supported SDK before changing dependencies.
Clipboard and safe-area modules are used with the installed SDK.

In Windows PowerShell:

```powershell
cd clients/mobile
npm ci
npx expo login
npx expo start --go --lan
```

Sign in to the same Expo account in Expo Go, as required by
[Expo's physical-iOS instructions](https://docs.expo.dev/get-started/start-developing/).
Connect iPhone and Windows to the same trusted Wi-Fi. Scan the terminal QR code
using the iPhone Camera and open it in Expo Go. `npm run ios` also starts this
physical-device LAN workflow; it does not launch a simulator. Windows does not
need Xcode or a local iOS build for Expo Go.

## Backend connection

Replace the prefilled backend URL with `http://<YOUR_LAN_IP>:8080`.
Recheck with `ipconfig` if DHCP or Wi-Fi changes, and enter the active Windows
IPv4 address in the app. Do not use
localhost, loopback, or an Android emulator alias on the iPhone.

Enter only the base URL. The client appends:
`/DarijaTranslator/api/translator/translate`.
Enter your WildFly application username/password and English text, then Translate.
JSON requests/responses preserve Unicode; Arabic translations are right-aligned
with RTL writing direction. Basic credentials are UTF-8 encoded before Base64.
Credentials remain only in component memory; Clear cancels the request and erases
the text, translation, and password. No Gemini secret belongs in this app.

WildFly must already listen on a LAN-accessible interface, rather than only
127.0.0.1. Allow inbound TCP 8080 for WildFly and Metro's displayed port (normally
8081) for Node through Windows Firewall on the trusted Private network only.
Do not disable the firewall. No Java code, server configuration, or firewall
rules were changed by this implementation. Guest Wi-Fi/client isolation or a
VPN can prevent phone-to-PC access even when Wi-Fi names match.

## iOS HTTP restrictions and configuration

[React Native networking guidance](https://reactnative.dev/docs/network) explains
that iOS App Transport Security (ATS) normally requires HTTPS. ATS and the iOS
Local Network permission are separate controls; granting one does not bypass
the other.

The checked [Expo Go SDK 58 native Info.plist](https://github.com/expo/expo/blob/sdk-58/apps/expo-go/ios/Exponent/Supporting/Info.plist)
contains `NSAppTransportSecurity: { NSAllowsArbitraryLoads: true }` and
`NSLocalNetworkUsageDescription`. This permits trying LAN HTTP with that Expo Go
build, but does not prove requests work with the build installed on your phone.
Allow Expo Go's Local Network prompt. If denied, enable Expo Go under iPhone
Settings > Privacy & Security > Local Network (or Settings > Apps > Expo Go >
Local Network), then reopen it.

Expo Go is a prebuilt host app: adding `ios.infoPlist` ATS exceptions to this
project's `app.json` cannot alter Expo Go's installed native policy. No ineffective
ATS override or global security exception was added to project configuration.

If HTTP is blocked on the installed iOS/Expo Go version, the Expo Go-compatible
solution is an HTTPS endpoint with a certificate trusted by the iPhone. Without
changing Java, a separately configured reverse proxy on Windows can terminate
TLS and forward the same REST path and Authorization header to WildFly port
8080. Enter its `https://<Windows-LAN-IP>:<TLS-port>` base URL in the app. The
certificate must include that IP in its Subject Alternative Name and chain to
a CA the iPhone trusts; for a private development CA, install its root profile
and explicitly enable full trust in iPhone Certificate Trust Settings. Merely
changing `http` to `https` or using an untrusted self-signed certificate is not
sufficient. No proxy or certificate was installed as part of this mobile change.

An alternative is an HTTPS hostname/proxy with a publicly trusted certificate.
Keep Basic Authentication enabled. HTTP sends reversible credentials in cleartext;
use it only for trusted local testing. Native ATS exceptions would require a
separate custom iOS build, outside this Expo Go workflow. A Metro `--tunnel`
only tunnels the JavaScript development server, not the Java REST backend.

## Verification

```powershell
npm run typecheck
npm run lint
npx expo install --check
npx expo-doctor
```

Static checks do not establish device integration. On the actual iPhone:

- Confirm Expo Go opens the app and Local Network permission is enabled.
- Enter the Windows LAN URL and valid WildFly credentials; translate `Hello`.
  Verify Arabic Darija output, RTL layout, and Copy by pasting into Notes.
- Edit multiline text; test keyboard scrolling, Clear, and password masking.
- Submit empty input or credentials; verify validation. Wrong credentials should
  produce 401; an account lacking permission should produce 403.
- Use a controlled mock endpoint for 400, 502, 503, malformed JSON, and missing
  translation responses; do not alter the working Java backend for these tests.
- Use an unreachable URL/disconnected Wi-Fi for network errors and a controlled
  mock delaying over 30 seconds for timeout/retry. Verify HTTP on this specific
  iPhone or use the trusted HTTPS proxy if blocked.
- Clear during a pending request; verify late output does not reappear. Fully
  close and reopen the app; credentials should be empty.

If testing connectivity with Safari, use the full REST path: a reachable 401 or
405 can show the server is responding. Safari reachability does not prove Expo
Go's ATS policy permits fetch or that authenticated POST integration works.

## Final feature scope

This mobile client translates typed English into written Darija. Copy and Clear
remain available. It has no Read Aloud, automatic spoken output, or native
microphone recognition. The unused `expo-speech` dependency has been removed.

## Future in-app microphone recognition on iPhone

No native recognition library is added: this client remains Expo Go compatible.
True in-app microphone recognition would require a separate development build,
an SDK-compatible native speech-recognition module/config plugin, iOS microphone
and speech-recognition usage descriptions, permission/error handling, and testing
on a physical iPhone. Configure these in app.json through the chosen plugin,
then build with EAS (including signing) or macOS/Xcode and install the development
client. Such native changes cannot be loaded into Expo Go. Alternatively, iPhone
keyboard dictation can populate the existing English input today. Any future
recognizer must disclose its audio processing policy and send only recognized
English through the existing authenticated Java translation endpoint.

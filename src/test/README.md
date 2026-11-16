# Backend unit tests

Use JDK 17 and Maven:

```sh
mvn clean test
mvn package
```

`TranslatorResourceTest` calls the resource directly. Mockito creates and injects
an entirely mocked GeminiService; no live service, API key, Google request, or
WildFly instance is required. Invalid requests verify zero service interactions.
Success/error tests check status, application/json, parsed JSON shape, escaping,
and Unicode. Parameterized cases are counted individually in Surefire reports
under `target/surefire-reports`.

JUnit Jupiter 5, Mockito's Jupiter extension, Parsson (JSON-P implementation), and
Jersey Common (standalone Jakarta REST Response provider) have test scope only.
WildFly continues to supply the deployed application's implementations. These
unit tests do not exercise HTTP transport, CDI deployment or GeminiService internals.

## Separate WildFly Basic Authentication checks

Authentication belongs to WildFly's web.xml/Elytron configuration and cannot be
validated by directly calling TranslatorResource. These are manual integration
checks, excluded from the unit test count. Keep the existing endpoint and security
configuration. On the deployed app, send POST to
`/DarijaTranslator/api/translator/translate` with application/json and body `{}`:

- No credentials: expect 401 and a Basic authentication challenge.
- Invalid application credentials: expect 401.
- Valid account without translator-user: expect 403.
- Valid account with translator-user: expect 400 JSON containing
  `{"error":"text must be a non-empty string."}`.

The invalid body prevents Gemini calls even after successful authentication.
Use existing test accounts through a local HTTP client; never commit passwords,
Authorization headers, or API keys. Server-generated 401/403 bodies are controlled
by WildFly and are not required to match the resource's JSON error format.

## Purpose

Lets the publicly hosted DealSync prototype use live Gemini suggestions for all visitors, without exposing the API key, while limiting misuse of its quota.

## ADDED Requirements

### Requirement: Hosted AI endpoints
The hosted deployment SHALL serve the AI status, test and generate endpoints at `/api/ai/status`, `/api/ai/test` and `/api/ai/generate`, with the same success response shapes as the local gateway.

#### Scenario: Generate request from the site
- **WHEN** the site sends a valid generate request and a key is configured
- **THEN** the response is 200 with the generated text, the model name and the latency

#### Scenario: Wrong method
- **WHEN** a request other than POST is sent to the test or generate endpoint
- **THEN** the response is 405 and Gemini is not called

### Requirement: API key stays on the server
The hosted deployment SHALL read the Gemini key only from a server-side environment variable. The key, or any part of it, MUST NOT appear in the browser bundle or in any endpoint response.

#### Scenario: Status on the hosted site
- **WHEN** anyone requests the hosted status endpoint
- **THEN** the response contains no key characters

#### Scenario: Built bundle
- **WHEN** the production build is searched for the key value
- **THEN** no match is found

### Requirement: Same-site requests only
The hosted deployment MUST reject test and generate requests whose origin does not match the site, and MUST NOT call Gemini for them.

#### Scenario: Request from another website
- **WHEN** a request has a different origin, or no origin or referer
- **THEN** the response is 403 and Gemini is not called

#### Scenario: Visitor using the site
- **WHEN** a visitor uses an AI feature on the site
- **THEN** no sign-in or code is needed and the result is labelled with the Gemini model

### Requirement: Request limits
The hosted deployment MUST reject oversized requests before calling Gemini, cap output tokens, and limit the request rate per client on a best-effort basis.

#### Scenario: Oversized request
- **WHEN** the system and user prompt together exceed the configured size limit
- **THEN** the response is 413 and Gemini is not called

#### Scenario: Excessive output tokens requested
- **WHEN** a request asks for more output tokens than the configured cap
- **THEN** Gemini is called with the capped value

#### Scenario: Too many requests
- **WHEN** a client or the deployment exceeds its request rate limit
- **THEN** the response is 429 and Gemini is not called

### Requirement: Deterministic fallback remains available
Every AI feature SHALL keep producing its deterministic fallback, labelled "Rule-based fallback", whenever live AI is unavailable to the viewer.

#### Scenario: No key configured
- **WHEN** a visitor uses an AI feature and no key is configured
- **THEN** the feature returns its fallback result and no generate request reaches Gemini

#### Scenario: Gemini fails
- **WHEN** Gemini returns an error or times out
- **THEN** the feature returns its fallback result with the failure reason available to the viewer

### Requirement: Local development unchanged
Running the app locally SHALL continue to use the key from `.env.local`, re-read per request, as it does today.

#### Scenario: Local key
- **WHEN** a developer sets a key in `.env.local` and runs the local server
- **THEN** AI features use Gemini with no restart

### Requirement: AI output remains a suggestion
Live AI results on the hosted site SHALL NOT change workspace data without a human action.

#### Scenario: Hosted AI suggestion
- **WHEN** a live Gemini result is returned on the hosted site
- **THEN** workspace data changes only after a person approves, confirms or applies it

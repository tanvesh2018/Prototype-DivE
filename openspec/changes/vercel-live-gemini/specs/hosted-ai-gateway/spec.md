## Purpose

Lets the publicly hosted DealSync prototype use live Gemini suggestions for authorised viewers, without exposing the API key or allowing anonymous use of its quota.

## ADDED Requirements

### Requirement: Hosted AI endpoints
The hosted deployment SHALL serve the AI status, test and generate endpoints at `/api/ai/status`, `/api/ai/test` and `/api/ai/generate`, with the same success response shapes as the local gateway.

#### Scenario: Authorised generate request
- **WHEN** an authorised viewer sends a valid generate request and a key is configured
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

### Requirement: Access code required on the hosted site
The hosted deployment MUST reject test and generate requests that do not carry the correct access code, and MUST NOT call Gemini for them. If no access code is configured, it SHALL refuse all test and generate requests.

#### Scenario: Missing or wrong code
- **WHEN** a generate request has a missing or incorrect access code
- **THEN** the response is 401 and Gemini is not called

#### Scenario: No code configured on the server
- **WHEN** a key is set but no access code is configured
- **THEN** status reports AI as unavailable and test and generate requests are refused

### Requirement: Request limits
The hosted deployment MUST reject oversized requests before calling Gemini, cap output tokens, and limit the request rate per client on a best-effort basis.

#### Scenario: Oversized request
- **WHEN** the system and user prompt together exceed the configured size limit
- **THEN** the response is 413 and Gemini is not called

#### Scenario: Excessive output tokens requested
- **WHEN** a request asks for more output tokens than the configured cap
- **THEN** Gemini is called with the capped value

#### Scenario: Too many requests
- **WHEN** a client exceeds the request or failed-code rate limit
- **THEN** the response is 429 and Gemini is not called

### Requirement: Deterministic fallback remains available
Every AI feature SHALL keep producing its deterministic fallback, labelled "Rule-based fallback", whenever live AI is unavailable to the viewer.

#### Scenario: Viewer has no access code
- **WHEN** a viewer without a code uses an AI feature on the hosted site
- **THEN** the feature returns its fallback result and no generate request is sent

#### Scenario: Gemini fails
- **WHEN** Gemini returns an error or times out
- **THEN** the feature returns its fallback result with the failure reason available to the viewer

### Requirement: Viewer can enter and clear an access code
The hosted site SHALL let a viewer enter, test and clear an access code in AI settings. A rejected code MUST be cleared from the browser and reported to the viewer.

#### Scenario: Correct code
- **WHEN** a viewer enters the correct code and tests the connection
- **THEN** the connected model is shown and later AI results are labelled with the Gemini model

#### Scenario: Rejected code
- **WHEN** the server rejects the stored code
- **THEN** the code is cleared, the viewer sees that it was rejected, and AI features use the fallback

### Requirement: Local development unchanged
Running the app locally SHALL continue to use the key from `.env.local`, re-read per request, without an access code.

#### Scenario: Local key
- **WHEN** a developer sets a key in `.env.local` and runs the local server
- **THEN** AI features use Gemini with no access code and no restart

### Requirement: AI output remains a suggestion
Live AI results on the hosted site SHALL NOT change workspace data without a human action.

#### Scenario: Hosted AI suggestion
- **WHEN** a live Gemini result is returned on the hosted site
- **THEN** workspace data changes only after a person approves, confirms or applies it

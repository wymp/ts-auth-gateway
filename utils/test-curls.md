Test cURL Calls
====================================================================================

```sh
APIKEY=1eb9b2d9-aa0b-68b0-2d59-5a25779175e7
SECRET=

# Create a new user
curl -H 'Origin: https://dev.acme-ventures.com' -u "$APIKEY:$SECRET" \
  -H 'Content-Type: application/json' -d '{"data":{"name":"Biff Stevenson","email":"biff.stevenson@bifford.me","password":"AaBbCc123!!","passwordConf":"AaBbCc123!!"}}' \
  http://localhost:6546/accounts/v1/users | jq .

# Fill in the session token from the above call
SESSION_TOKEN=
REFRESH_TOKEN=

# Get the logged-in user's data
curl -H 'Origin: https://dev.acme-ventures.com' -H "Authorization: Basic $(echo -n "$APIKEY:$SECRET" | base64 -w0),Bearer session:$SESSION_TOKEN" http://localhost:6546/accounts/v1/users/current | jq .
curl -H 'Origin: https://dev.acme-ventures.com' -H "Authorization: Basic $(echo -n "$APIKEY:$SECRET" | base64 -w0),Bearer session:$SESSION_TOKEN" http://localhost:6546/accounts/v1/users/current/memberships | jq .
curl -H 'Origin: https://dev.acme-ventures.com' -H "Authorization: Basic $(echo -n "$APIKEY:$SECRET" | base64 -w0),Bearer session:$SESSION_TOKEN" http://localhost:6546/accounts/v1/users/current/emails | jq .

# Email verification flow
EMAIL_ADDR_ESC=biff.stevenson%40bifford.me
curl -H 'Origin: https://dev.acme-ventures.com' -H "Authorization: Basic $(echo -n "$APIKEY:$SECRET" | base64 -w0),Bearer session:$SESSION_TOKEN" -X POST http://localhost:6546/accounts/v1/users/current/emails/$EMAIL_ADDR_ESC/generate-verification | jq .
EMAIL_VER_CODE=
curl -H 'Origin: https://dev.acme-ventures.com' -H "Authorization: Basic $(echo -n "$APIKEY:$SECRET" | base64 -w0),Bearer session:$SESSION_TOKEN" -X POST -d '{"data":{"type":"verification-codes","code":"'$EMAIL_VER_CODE'"}}' http://localhost:6546/accounts/v1/users/current/emails/$EMAIL_ADDR_ESC/verify | jq .

# Log in with password
curl -H 'Origin: https://dev.acme-ventures.com' -H "Authorization: Basic $(echo -n "$APIKEY:$SECRET" | base64 -w0)" -H "Content-Type: application/json" -d '{"data":{"t":"password-step","email":"kael.shipman@gmail.com","password":"AaBbCc123!!","state":"aaaabbbbccccdddd1111222233334444"}}' http://localhost:6546/accounts/v1/sessions/login/password | jq .

# Refresh a session
curl -H 'Origin: https://dev.acme-ventures.com' -H "Content-Type: application/json" -H "Authorization: Basic $(echo -n "$APIKEY:$SECRET" | base64 -w0)" -d '{"data":{"t":"refresh-tokens","token":"'$REFRESH_TOKEN'"}}' http://localhost:6546/accounts/v1/sessions/refresh | jq .

# Log out
curl -H 'Origin: https://dev.acme-ventures.com' -H "Content-Type: application/json" -H "Authorization: Basic $(echo -n "$APIKEY:$SECRET" | base64 -w0),Bearer session:$SESSION_TOKEN" -X POST http://localhost:6546/accounts/v1/sessions/logout | jq .

# Create an organization
curl -H 'Origin: https://dev.acme-ventures.com' -H "Content-Type: application/json" -H "Authorization: Basic $(echo -n "$APIKEY:$SECRET" | base64 -w0),Bearer session:$SESSION_TOKEN" -d '{"data":{"type":"organizations","name":"My Organization"}}' http://localhost:6546/accounts/v1/organizations | jq .
```

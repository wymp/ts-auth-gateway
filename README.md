Auth Gateway
=========================================================================

This is a library and reference implementation for a production-grade Authn/z gateway. It performs
the following functions:

* Validates client ID and (optional) secret against database records
* (optional) Rate-limits requests from clients
* Registers new users
* Validates user data (session token or oauth (TODO)), if passed
* Generates new session credentials for users on valid authentication (including optional 2fa)
* Enforces configurable restrictions on clients
* Manages relationships between organizations, clients and users.
* TODO: Generates new oauth credentials on valid request

### Authentication

Every authentication system will have its own flow. Following is a detailed description of the flow
presented by this system:

* Authentication is a multistep process where the next step is returned in response to the last
  submission until a session is finally returned. Steps are submitted via the
  [`POST /accounts/v1/sessions/login/:step` endpoint](/docs/api.v1.html#tag/Sessions).
* If the submission returns a response with type `sessions`, then it is a session and no further
  steps are required.
* The first step you submit will usually be either [`email`](/docs/api.v1.html#operation/post-accounts-v1-sessions-login-step)
  or [`password`](/docs/api.v1.html#operation/post-accounts-v1-sessions-login-password).
* A "step" response is identified by a `t` value which is `"steps"`, while a "session" response is
  identified by a `t` value which is `"sessions"`. In the event of an error, the `t` value is
  `"error"`. When a "step" response is received, the `step` parameter will contain the next
  step to submit. Clients are responsible for knowing the necessary parameters to submit for each
  step.

### Using Session and Reset Tokens

Successful authentication results in a `sessions` object containing a `token` value and a `refresh`
value. The `token` value is to be used to make requests against the API, while the `refresh` value
is to be used to obtain new values when the token expires.

Additionally, the `token` value may be used to log out (i.e., invalidate) a session.

To refresh a session using a refresh token, submit a payload to the `POST /accounts/v1/sessions/refresh`
endpoint as indicated in the [API docs](/docs/api.v1.html#operation/post-accounts-v1-sessions-refresh).
The response will be a session object with new refresh and "token" values.

To log out of a session, submit a request to the `POST /accounts/v1/sessions/logout` endpoint in
accordance with the [API docs](/docs/api.v1.html#operation/post-accounts-v1-sessions-logout).


### Running

#### Database

This service is expecting a MySQL database. It provides a database schema in the `db/migrations`
folder which may be applied using `shmig`. `shmig` is a small, lightweight shell-based database
migration framework for various SQL servers (including MySQL).

You can install shmig on Debian-based machines by installing the apt repo [here](https://packages.kaelshipman.me/)
and then running `sudo apt-get install shmig`. Alternatively, you can go to the Wymp fork of the
shmig repo [here](https://github.com/wymp/shmig/) and just download and install the file directly.

When you have shmig installed, just create a new database and user (if necessary), add those
credentials to your `shmig.local.conf` file, cd into `db` and run `shmig up`.

### TODO

#### Accounts Endpoints

* [ ] **Organizations**
  * [x] GET    /accounts/v1/organizations
  * [x] POST   /accounts/v1/organizations
  * [x] GET    /accounts/v1/organizations/:id
  * [ ] PATCH  /accounts/v1/organizations/:id
  * [ ] DELETE /accounts/v1/organizations/:id
* [ ] **Users**
  * [x] GET    /accounts/v1/users
  * [x] POST   /accounts/v1/users
  * [x] GET    /accounts/v1/users/:id
  * [ ] PATCH  /accounts/v1/users/:id
  * [ ] DELETE /accounts/v1/users/:id
  * [ ] GET    /accounts/v1/users/:id/emails
  * [ ] POST   /accounts/v1/users/:id/emails
  * [ ] GET    /accounts/v1/users/:id/roles
  * [ ] POST   /accounts/v1/users/:id/roles
  * [ ] DELETE /accounts/v1/users/:id/roles
* [ ] **Clients**
  * [ ] GET    /accounts/v1/clients/:id
  * [ ] PATCH  /accounts/v1/clients/:id
  * [ ] DELETE /accounts/v1/clients/:id
  * [ ] GET    /accounts/v1/clients/:id/roles
  * [ ] POST   /accounts/v1/clients/:id/roles
  * [ ] DELETE /accounts/v1/clients/:id/roles
  * [ ] GET    /accounts/v1/clients/:id/access-restrictions
  * [ ] POST   /accounts/v1/clients/:id/access-restrictions
  * [ ] DELETE /accounts/v1/clients/:id/access-restrictions
  * [ ] GET    /accounts/v1/organizations/:id/clients
  * [ ] POST   /accounts/v1/organizations/:id/clients
* [ ] **Memberships**
  * [ ] GET    /accounts/v1/users/:id/memberships
  * [ ] GET    /accounts/v1/organizations/:id/memberships
  * [ ] POST   /accounts/v1/organizations/:id/memberships
* [ ] **Sessions**
  * [x] GET    /accounts/v1/sessions
  * [x] GET    /accounts/v1/users/:id/sessions
  * [-] POST   /accounts/v1/sessions/login/email
  * [ ] POST   /accounts/v1/sessions/login/password
  * [ ] POST   /accounts/v1/sessions/login/code
  * [ ] POST   /accounts/v1/sessions/login/totp
  * [ ] POST   /accounts/v1/sessions/refresh
  * [ ] POST   /accounts/v1/sessions/logout

#### General

* [ ] Implement API regression tests
* [ ] Use TypeDoc to create library documentation
* [ ] Implement hook system that allows for alternate handling and/or system extensibility
* [ ] Export library functions correctly

#### Later Improvements

* [ ] Implement data transactions in database for things like user creation


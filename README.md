Auth Gateway
=========================================================================

**WARNING: THIS IS AN EXPERIMENT IN EARLY DEVELOPMENT. IT IS SUBJECT TO BREAKING CHANGES AND IS NOT
GUARANTEED TO WORK WELL OR EVEN AT ALL.**

**ADDITIONAL WARNING and TODO:** This codebase was created several years ago. It has some valid concepts
in it, but it was designed to actually act as the gateway through which requests passed, meaning it
contains extraneous logic for rate-limiting and (optionally) load balancing. Now, with the availability
of modern components such as [Traefik](https://traefik.io/traefik/), you should absolutely NOT use this
service as a true gateway. It should instead be used as an authentication plugin for Traefik and as
a user registration/login endpoint. However, it has not yet been modified to actually function as an
auth plugin for Traefik (that's the to-do).

---------------------------------------------------------------------------------------------------

This is a library and reference implementation for a production-grade Authn/z gateway (similar in
concept to AWS's API Gateway). It performs
the following functions:

* (optional) Validates that a client ID was passed with every request
* Validates passed client ID and (optional) secret against database records
* (optional) Rate-limits requests per client ID
* Registers new users
* Validates user data (session token or oauth (TODO)), if passed
* Generates new session credentials for users on valid authentication (including optional 2fa (TODO))
* Enforces configurable restrictions on clients (e.g., IP restrictions, host restrictions, or target
  API restrictions)
* Manages relationships between organizations, clients and users.
* TODO: Generates new oauth credentials on valid request

It is intended to be used as a front door to a collection of microservices. For example, say you
have an exchange service, a market data service, a currencies service and a monitoring service. You
would access all of those separate services through an instance of this gateway via urls such as
`/exchange/v1`, `/market-data/v1`, `/currencies/v1` and `/monitoring/v1`. You can maintain separate
versions of each service by using different version specifiers (which you would configure in the
database for this service to route to separate instances), and each service would get a uniform
[Request Info object](https://github.com/wymp/ts-types/blob/9d2047e1338e8cc9c557e675c5dfbade29a40745/src/Auth.ts#L3)
containing information about the request, such as the client from which the request was issued and
its associated roles, and the user that made the request and their roles.

This service has built-in endpoints for account management at `/accounts/v1`. Those endpoints
facilitate things like user creation, login, organization management, etc.


### Purpose of This Codebase

This codebase is intended to be an API gateway that is (eventually) usable out of the box as a clone
or optionally brought in as a dependency and used as a library.

If you were to use it out of the box, you would clone this repo; use the migrations in the `db`
folder to set up the database, loading whatever seed data in that is appropriate for your use case
(e.g., your organization, a sysadmin user, and some back-end services in the `apis` table); compile
the source code into JS files; then deploy the built files however you wish to a server of your
choice.

However, authentication and user management is _very_ domain specific, so it's very likely that it
won't quite work for your specific needs out of the box. With that in mind, it is also intended to
be documented and built well enough that you would be able to relatively easily fork the repo and
modify it for your specific needs (definitely a work in progress).


### Authentication

Every authentication system will have its own flow. Following is a detailed description of the flow
presented by this system:

* Authentication is a multistep process where the next step is returned in response to the last
  submission until a session is finally returned. Steps are submitted via the
  [`POST /accounts/v1/sessions/login/:step` endpoint](/docs/api.v1.html#tag/Sessions).
* If the submission returns a response with `t === "session"`, then it is a session and no further
  steps are required.
* The first step you submit will usually be either [`email`](/docs/api.v1.html#operation/post-accounts-v1-sessions-login-step)
  or [`password`](/docs/api.v1.html#operation/post-accounts-v1-sessions-login-password).
* A "step" response is identified by a `t` value which is `"step"`, while a "session" response is
  identified by a `t` value which is `"session"`. In the event of an error, the `t` value is
  `"error"`. When a "step" response is received, the `step` parameter will contain the next
  step to submit. Clients are responsible for knowing the necessary parameters to submit for each
  step.
* At the time of this writing, there are only 4 steps: `email`, `password`, `code` and `totp`. They
  are defined as follows:
  * `email` - Send an email with a login code in it to the user's login email. The user clicks the
    link in the email, which should hand the client the login code, which it can use for the `code`
    step.
  * `code` - Submit a login code from an email
  * `password` - Submit an email/password combination
  * `totp` - Submit a 2fa TOTP (this requires a code that is returned as part of the step response)


### Using Session and Refresh Tokens

Successful authentication results in a `sessions` object containing a `token` value and a `refresh`
value. The `token` value is to be used to make requests against the API, while the `refresh` value
is to be used to obtain new values when the token expires.

Additionally, either value may be used to log out (i.e., invalidate) a session.

To refresh a session using a refresh token, submit a payload to the `POST /accounts/v1/sessions/refresh`
endpoint as indicated in the [API docs](/docs/api.v1.html#operation/post-accounts-v1-sessions-refresh).
The response will be a session object with new "refresh" and "token" values.

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

* [x] **Organizations**
  * [x] GET    /accounts/v1/organizations
  * [x] POST   /accounts/v1/organizations
  * [x] GET    /accounts/v1/organizations/:id
  * [x] PATCH  /accounts/v1/organizations/:id
  * [x] DELETE /accounts/v1/organizations/:id
* [x] **Users**
  * [x] GET    /accounts/v1/users
  * [x] POST   /accounts/v1/users
  * [x] GET    /accounts/v1/users/:id
  * [x] PATCH  /accounts/v1/users/:id
  * [x] DELETE /accounts/v1/users/:id
  * [x] GET    /accounts/v1/users/:id/roles
  * [x] POST   /accounts/v1/users/:id/roles
  * [x] DELETE /accounts/v1/users/:id/roles/:roleId
  * [x] POST   /accounts/v1/users/:id/change-password
* [x] **Emails**
  * [x] GET    /accounts/v1/users/:id/emails
  * [x] POST   /accounts/v1/users/:id/emails
  * [x] DELETE /accounts/v1/users/:id/emails/:id
  * [x] POST   /accounts/v1/users/:id/emails/:id/send-verification
  * [x] POST   /accounts/v1/users/:id/emails/:id/verify
* [x] **Clients**
  * [x] GET    /accounts/v1/organizations/:id/clients
  * [x] POST   /accounts/v1/organizations/:id/clients
  * [x] GET    /accounts/v1/organizations/:id/clients/:id
  * [x] PATCH  /accounts/v1/organizations/:id/clients/:id
  * [x] DELETE /accounts/v1/organizations/:id/clients/:id
  * [x] POST   /accounts/v1/organizations/:id/clients/:id/refresh-secret
* [x] **Client Roles**
  * [x] GET    /accounts/v1/organizations/:id/clients/:id/roles
  * [x] POST   /accounts/v1/organizations/:id/clients/:id/roles
  * [x] DELETE /accounts/v1/organizations/:id/clients/:id/roles/:id
* [x] **Client Access Restrictions**
  * [x] GET    /accounts/v1/organizations/:id/clients/:id/access-restrictions
  * [x] POST   /accounts/v1/organizations/:id/clients/:id/access-restrictions
  * [x] DELETE /accounts/v1/organizations/:id/clients/:id/access-restrictions/:id
* [x] **Memberships**
  * [x] GET    /accounts/v1/users/:id/memberships
  * [x] GET    /accounts/v1/organizations/:id/memberships
  * [x] POST   /accounts/v1/organizations/:id/memberships
  * [x] PATCH /accounts/v1/org-memberships/:id
  * [x] DELETE /accounts/v1/org-memberships/:id
* [-] **Sessions**
  * [x] GET    /accounts/v1/sessions
  * [x] GET    /accounts/v1/users/:id/sessions
  * [-] POST   /accounts/v1/sessions/login/email
  * [x] POST   /accounts/v1/sessions/login/password
  * [x] POST   /accounts/v1/sessions/login/code
  * [-] POST   /accounts/v1/sessions/login/totp
  * [x] POST   /accounts/v1/sessions/refresh
  * [x] POST   /accounts/v1/sessions/logout

#### General

* [ ] Implement TOTP flow and infrastructure
* [ ] Implement API regression tests
* [ ] Use TypeDoc to create library documentation
* [ ] Implement hook system that allows for alternate handling and/or system extensibility
* [ ] Export library functions correctly. In many cases, this may include refactoring functionality
      between endpoint handlers and functions.
* [ ] Improve logging in various areas of the code
  * [ ] Emails module
* [ ] Full authorization audit for every endpoint

#### Later Improvements

* [ ] Implement data transactions in database for things like user creation
* [ ] Fix lots of things around `verification-codes`. We need to refactor around the idea that the
      `state` parameter passed in by a user represents a certain login flow execution, rather than
      having it be somewhat tangential. This flows into login code and totp authn flows.
  * [ ] Currently they require an email address, but in some cases we would prefer to associated a
        userId
  * [ ] We've switched back to calling the user generated token "state", and we should reflect that
        in the database.
* [ ] Refactor `session-tokens` to have `tokenSha256` and `refreshTokenSha256` all together. When a
      refresh token is consumed or invalidated, the associated session token should also be consumed
      or invalidated, and that should be verified by the gateway. I.e., users should not be able to
      use session tokens associated with consumed refresh tokens to successfully make requests.
* [ ] Protect email addresses as PII
* [ ] Implement generalized multi-step process for dangerous operations (e.g., DELETE user). This
      would mean, for example, any endpoint could return an `auth-step` or something, and an auth
      flow would ensue, resulting in completion of the operation being attempted.
* [ ] Possibly refactor endpoits? I'm starting to question my original philosophies. Perhaps it's
      fine, but I believe at very least there are some inconsistencies that can be resolved. E.g.,
      When do we force access through a hierarchical endpoint vs a flat one (e.g.,
      `/organizations/:id/clients/:id` vs `/clients/:id`)?


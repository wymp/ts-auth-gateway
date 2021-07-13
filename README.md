Auth Gateway
=========================================================================

This is a library and reference implementation for a production-grade Authn/z gateway. It performs
the following functions:

* Validates client ID and (optional) secret against database records
* (optional) Rate-limits requests from clients
* Registers new users
* Validates user data (session token or oauth (TODO)), if passed
* Generates new session credentials for users on valid authentication (including optional 2fa)
* TODO: Generates new oauth credentials on valid request

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
  * [ ] GET    /accounts/v1/sessions
  * [ ] DELETE /accounts/v1/sessions
  * [ ] GET    /accounts/v1/users/:id/sessions
  * [ ] POST   /accounts/v1/users/:id/sessions/refresh
* [ ] **Authentication**
  * [ ] POST /accounts/v1/authn

#### General

* [ ] Implement API regression tests
* [ ] Use TypeDoc to create library documentation
* [ ] Implement hook system that allows for alternate handling and/or system extensibility
* [ ] Export library functions correctly

#### Later Improvements

* [ ] Implement data transactions in database for things like user creation


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
  * [x] GET    /accounts/v3/organizations
  * [x] POST   /accounts/v3/organizations
  * [x] GET    /accounts/v3/organizations/:id
  * [ ] PATCH  /accounts/v3/organizations/:id
  * [ ] DELETE /accounts/v3/organizations/:id
* [ ] **Users**
  * [-] GET    /accounts/v3/users
    * Need to include user roles in return
  * [x] POST   /accounts/v3/users
  * [-] GET    /accounts/v3/users/:id
    * Need to include user roles in return
  * [ ] PATCH  /accounts/v3/users/:id
  * [ ] DELETE /accounts/v3/users/:id
  * [ ] GET    /accounts/v3/users/:id/emails
  * [ ] POST   /accounts/v3/users/:id/emails
  * [ ] GET    /accounts/v3/users/:id/roles
  * [ ] POST   /accounts/v3/users/:id/roles
  * [ ] DELETE /accounts/v3/users/:id/roles
* [ ] **Clients**
  * [ ] GET    /accounts/v3/clients/:id
  * [ ] PATCH  /accounts/v3/clients/:id
  * [ ] DELETE /accounts/v3/clients/:id
  * [ ] GET    /accounts/v3/clients/:id/roles
  * [ ] POST   /accounts/v3/clients/:id/roles
  * [ ] DELETE /accounts/v3/clients/:id/roles
  * [ ] GET    /accounts/v3/clients/:id/access-restrictions
  * [ ] POST   /accounts/v3/clients/:id/access-restrictions
  * [ ] DELETE /accounts/v3/clients/:id/access-restrictions
  * [ ] GET    /accounts/v3/organizations/:id/clients
  * [ ] POST   /accounts/v3/organizations/:id/clients
* [ ] **Memberships**
  * [ ] GET    /accounts/v3/users/:id/memberships
  * [ ] GET    /accounts/v3/organizations/:id/memberships
  * [ ] POST   /accounts/v3/organizations/:id/memberships
* [ ] **Sessions**
  * [ ] GET    /accounts/v3/sessions
  * [ ] DELETE /accounts/v3/sessions
  * [ ] GET    /accounts/v3/users/:id/sessions
  * [ ] POST   /accounts/v3/users/:id/sessions/refresh
* [ ] **Authentication**
  * [ ] POST /accounts/v3/authn

#### Later Improvements

* [ ] Implement data transactions in database for things like user creation


# spgldap2rest

expose ldap auth (simple bind) via a rest api. A permanentely logged in service
user searches for the entered userid in the ldap and tries a simple bind with
the found DN and the provided password. The Rest API answers with either HTTP
200 resp. 401 (unauthorized) and some details in the json answer body.

## Example success

Request

```shell
POST http://localhost:3000/verify
Content-Type: application/json

{
   "user": "kuderwom",
   "passwd": "Pre?ag3"
}
```

Response

```shell
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "auth": true
  "dn": "CN=kuderwom,ou=bla,ou=blub,DC=example,DC=domain",
  "description": "secretary of choice",
  "mail": "kuderwom@example.domain",
}
```

## Example failure

same request as above, but wrong password. Response:

```shell
HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8

{
  "auth": false,
  "ip": "::ffff:127.0.0.1",
  "error": "Invalid Credentials"
}
```

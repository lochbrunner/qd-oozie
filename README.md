# Quick & Dirty Oozie

Easy way to define workflows.

## Usage

Define a flow by adding a flow definition yaml file to the *flows* folder.

Example:

```yaml
name: "Simple"
entrypoints:
  - sleeper
stages:
  sleeper:
    command: sleep
    args:
      - "2"
    success: [lister]
    fail: []
  lister:
    command: ls
    args:
      - "."
    success: []
    fail: []
```

Start the service via `node index.js`.

Trigger a job by

```http
POST http://localhost:4000/start HTTP/1.1
content-type: application/json

{
    "name": "Simple"
}
```

which returns the id of the started flow

```json
{
  "id": 0
}
```

Query it's state by

```http
GET http://localhost:4000/flow/0
```

which should return

```json
{
  "stages": [{
    "status": "SUCCEEDED",
    "stdout": "",
    "stderr": "",
    "exit-code": 0
  }, {
    "status": "SUCCEEDED",
    "stdout": "index.js\njobs\nnode_modules\npackage.json\nREADME.md\ntest.http\nyarn.lock\n",
    "stderr": "",
    "exit-code": 0
  }],
  "id": 0,
  "running": 0,
  "status": "SUCCEEDED"
}
```

when every job of the flow finished.

### Templates

**Quick & Dirty Oozie** uses [mustache](https://github.com/janl/mustache.js) in order to support templates.

Flow:

```yaml
name: "WithArgs"
entrypoints:
  - echo
stages:
  echo:
    command: echo
    args:
      - "Hello {{name}}!"
    success: []
    fail: []
```

The param `name` get resolved from the `params` object of the request:

```http
POST http://localhost:4000/start HTTP/1.1
content-type: application/json

{
    "name": "Simple",
    "params": {
        "name": "World"
    }
}
```

Will print `Hello World!` to the stdout.

> Note: Some local tests showed that the params get sanitized and no words separation of the arguments take place. We do not guarantee that it will behave similarly on your system!

## Missing features

* Schema checks of the flows and the submits
* Cycle detection

## Disclaimer

> Note: The server acts as a remote shell executer without any security checks!
> Run the server in a secure and encapsulated environment!

We will provide no warranty!
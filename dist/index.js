"use strict";

var express = require('express');

var child_process = require('child_process');

var yaml = require('js-yaml');

var fs = require('fs');

var app = express();
app.use(express.json());
var port = 4000;
var flowDefinitions = {};
var flowStates = [];

var loadAllJobs = function loadAllJobs() {
  var dir = './flows';
  fs.readdirSync(dir).forEach(function (file) {
    var filename = dir + '/' + file;
    if (fs.statSync(filename).isDirectory()) return;

    try {
      var flow = yaml.safeLoad(fs.readFileSync(filename, 'utf8'));
      flowDefinitions[flow.name] = flow;
    } catch (e) {
      console.error(e);
    }
  });
};

var launchProcess = function launchProcess(stageName, flowDefinition, flowState) {
  var jobDefinition = flowDefinition.stages[stageName];
  var state = {
    status: 'RUNNING',
    stdout: '',
    stderr: '',
    'exit-code': null
  };
  flowState.stages.push(state);
  console.log("Launching ".concat(jobDefinition.command, " with args ").concat(jobDefinition.args.join(' ')));
  var proc = child_process.spawn(jobDefinition.command, jobDefinition.args);
  flowState.running++;
  proc.stdout.on('data', function (data) {
    state.stdout += data;
  });
  proc.stderr.on('data', function (data) {
    state.stderr += data;
  });
  proc.on('close', function (code) {
    flowState.running--;
    state['exit-code'] = code;
    state.status = code === 0 ? 'SUCCEEDED' : 'FAILED';

    if (state.status === 'SUCCEEDED') {
      console.log("".concat(stageName, " succeeded"));
      if (jobDefinition.success.length === 0 && flowState.running === 0) flowState.status = 'SUCCEEDED';
      jobDefinition.success.forEach(function (newStageName) {
        return launchProcess(newStageName, flowDefinition, flowState);
      });
    } else {
      console.log("".concat(stageName, " failed"));
      if (jobDefinition.fail.length === 0 && flowState.running === 0) flowState.status = 'FAILED';
      jobDefinition.fail.forEach(function (newStageName) {
        return launchProcess(newStageName, flowDefinition, flowState);
      });
    }
  });
};

var launchFlow = function launchFlow(flowName) {
  var flowDefinition = flowDefinitions[flowName];
  var id = flowStates.length;
  var flowState = {
    stages: [],
    id: id,
    running: 0,
    status: 'RUNNING'
  };
  flowStates.push(flowState); // TODO(ML): Cycle detection

  flowDefinition.entrypoints.forEach(function (stageName) {
    return launchProcess(stageName, flowDefinition, flowState);
  });
  return id;
}; // POST method route


app.post('/start', function (req, res) {
  var name = req.body.name;

  if (!name) {
    res.status(404).send(JSON.stringify({
      error: "No command or args specified!"
    }));
    return;
  }

  var newId = launchFlow(name);
  res.send(JSON.stringify({
    id: newId
  }));
});
app.get('/flow/:id', function (req, res) {
  var id = req.params.id;

  if (id >= flowStates.length) {
    res.status(404).send(JSON.stringify({
      error: "No flow with the id ".concat(id, " found!")
    }));
    return;
  }

  res.send(JSON.stringify(flowStates[id]));
});
app.get('/flows', function (req, res) {
  var responseData = flowStates.map(function (j) {
    return {
      id: j.id,
      status: j.status
    };
  });
  res.send(JSON.stringify(responseData));
});
loadAllJobs();
app.listen(port, function () {
  return console.log("Listening on port ".concat(port, "."));
});
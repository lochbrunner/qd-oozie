const express = require('express');
const child_process = require('child_process');
const yaml = require('js-yaml');
const fs = require('fs');
const mustache = require('mustache');

const app = express();

app.use(express.json());

const port = 4000;

const flowDefinitions = {};
const flowStates = [];

const loadAllJobs = () => {
  const dir = './flows'
  fs.readdirSync(dir).forEach(file => {
    const filename = dir + '/' + file;
    if (fs.statSync(filename).isDirectory()) return;
    try {
      const flow = yaml.safeLoad(fs.readFileSync(filename, 'utf8'));
      flowDefinitions[flow.name] = flow;
    } catch (e) {
      console.error(e);
    }
  });
};

const launchProcess = (stageName, flowDefinition, flowState, params) => {
  const jobDefinition = flowDefinition.stages[stageName];
  const state = {
    name: stageName,
    status: 'RUNNING',
    stdout: '',
    stderr: '',
    'exit-code': null
  };
  flowState.stages.push(state);

  console.log(`Params: ${JSON.stringify(params)}`);

  const renderedArgs =
    jobDefinition.args.map(code => mustache.render(code, params));

  console.log(
    `Launching ${jobDefinition.command} with args ${renderedArgs.join(' ')}`);
  const proc = child_process.spawn(jobDefinition.command, renderedArgs);
  flowState.running++;

  proc.stdout.on('data', data => {
    state.stdout += data;
  });

  proc.stderr.on('data', data => {
    state.stderr += data;
  });

  proc.on('close', code => {
    flowState.running--;
    state['exit-code'] = code;
    state.status = code === 0 ? 'SUCCEEDED' : 'FAILED';

    if (state.status === 'SUCCEEDED') {
      console.log(`${stageName} succeeded`);
      if (jobDefinition.success.length === 0 && flowState.running === 0)
        flowState.status = 'SUCCEEDED';

      jobDefinition.success.forEach(
        newStageName =>
        launchProcess(newStageName, flowDefinition, flowState, params));
    } else {
      console.log(`${stageName} failed`);
      if (jobDefinition.fail.length === 0 && flowState.running === 0)
        flowState.status = 'FAILED';

      jobDefinition.fail.forEach(
        newStageName =>
        launchProcess(newStageName, flowDefinition, flowState, params));
    }
  });
};

const launchFlow = (flowName, params) => {
  const flowDefinition = flowDefinitions[flowName];
  const id = flowStates.length;
  const flowState = {
    name: flowName,
    stages: [],
    id,
    running: 0,
    status: 'RUNNING'
  };
  flowStates.push(flowState);
  // TODO(ML): Cycle detection
  flowDefinition.entrypoints.forEach(
    stageName => launchProcess(stageName, flowDefinition, flowState, params));
  return id;
};

// POST method route
app.post('/start', (req, res) => {

  const name = req.body.name;
  const params = req.body.params;
  if (!name) {
    res.status(404).send(JSON.stringify({
      error: `Missing flow name!`
    }));
    return;
  }
  const newId = launchFlow(name, params || {});
  res.send(JSON.stringify({
    id: newId
  }));
});

app.get('/flow/:id', (req, res) => {
  const {
    id
  } = req.params;

  if (id >= flowStates.length) {
    res.status(404).send(
      JSON.stringify({
        error: `No flow with the id ${id} found!`
      }));
    return;
  }
  res.send(JSON.stringify(flowStates[id]));
});

app.get('/flows', (req, res) => {
  const responseData = flowStates.map(j => ({
    id: j.id,
    status: j.status
  }));
  res.send(JSON.stringify(responseData));
});

loadAllJobs();
app.listen(port, () => console.log(`Listening on port ${port}.`))
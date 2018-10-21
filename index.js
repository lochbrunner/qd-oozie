const express = require('express');
const child_process = require('child_process');

const app = express();

app.use(express.json());

const port = 4000;

const jobs = []; // The index is the key

// POST method route
app.post('/start', (req, res) => {

    const command = req.body.command;
    const args = req.body.arguments;
    if (!command || !args) {
        res.status(404).send(JSON.stringify({
            error: `No command or args specified!`
        }));
        return;
    }
    const newId = jobs.length;

    const proc = child_process.spawn(command, args);

    const jobInfo = {
        id: newId,
        status: 'RUNNING',
        stdout: '',
        stderr: ''
    };

    proc.stdout.on('data', data => {
        jobInfo.stdout += data;
    });

    proc.stderr.on('data', data => {
        jobInfo.stderr += data;
    });

    proc.on('close', code => {
        jobInfo['exit-code'] = code;
        jobInfo.status = code === 0 ? 'SUCCEEDED' : 'FAILED';
    });

    jobs.push(jobInfo);
    res.send(JSON.stringify({
        id: newId
    }));
})

app.get('/job/:id', (req, res) => {
    const {
        id
    } = req.params;

    if (id >= jobs.length) {
        res.status(404).send(JSON.stringify({
            error: `No job with the id ${id} found!`
        }));
        return;
    }
    res.send(JSON.stringify(jobs[id]));
})

app.get('/jobs', (req, res) => {
    const responseData = jobs.map(j => ({
        id: j.id,
        status: j.status
    }));
    res.send(JSON.stringify(responseData));
});

app.listen(port, () => console.log(`Listening on port ${port}.`))
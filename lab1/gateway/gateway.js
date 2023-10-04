const path = require('path');
const grpc = require('@grpc/grpc-js');
const { loadSync } = require('@grpc/proto-loader');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Load the proto files
const packageDefinition = loadSync([
  path.resolve(__dirname, '../protobufs/records.proto'),
  path.resolve(__dirname, '../protobufs/prescription.proto'),
], {keepCase: true});

// Create gRPC clients for internal communication
var services = grpc.loadPackageDefinition(packageDefinition);
const recordsService = services.records;
const prescriptionService = services.prescription;

// Define RESTful routes for the client
app.get('/records/:record_id', (req, res) => {
  const { record_id } = req.params;

  // Convert RESTful request to gRPC request
  const request = { record_id };

  // Create a gRPC client
  const client = new recordsService.RecordService('localhost:50051', grpc.credentials.createInsecure());

  const timeoutMilliseconds = 100; // 5 seconds

  // Wrap the gRPC call with a timeout
  return new Promise((resolve, reject) => {
    const deadline = new Date();
    deadline.setMilliseconds(deadline.getMilliseconds()+ timeoutMilliseconds);

    client.GetRecordInfo(request, {deadline}, (error, response) => {
      let code;
      if (error) {
        code = error.code;
        console.error(error.details);
        res.status(408).json(error.details);
      } else {
        code = grpc.status.OK;
        console.log(`Received gRPC response for getRecordInfo: ${JSON.stringify(response)}`);
        res.json(response);
      }
      resolve();
    });
  });
});

app.get('/records', (req, res) => {
  // Convert RESTful request to gRPC request
  const request = {};
  // Create a gRPC client
  const client = new recordsService.RecordService('localhost:50051', grpc.credentials.createInsecure());

  const timeoutMilliseconds = 5000; // 5 seconds
  // Wrap the gRPC call with a timeout
  return new Promise((resolve, reject) => {
    const deadline = new Date(Date.now() + timeoutMilliseconds);

    client.ListRecords(request, { deadline }, (error, response) => {
      let code;
      if (error) {
        code = error.code;
        console.error(error.details);
        res.status(408).json(error.details);
      } else {
        code = grpc.status.OK;
        console.log(`Received gRPC response for listRecords: ${JSON.stringify(response)}`);
        res.json(response);
      }
      resolve();
    });
  });
});

app.post('/records', (req, res) => {
  const { name, medical_history } = req.body;
  // Convert RESTful request to gRPC request
  const request = { name, medical_history };
  console.log(request);
  console.log(typeof(request.medical_history));
  // console.log(`gRPC Request: ${JSON.stringify(request)}`);
  // Create a gRPC client
  const client = new recordsService.RecordService('localhost:50051', grpc.credentials.createInsecure());

  const timeoutMilliseconds = 5000; // 5 seconds
  // Wrap the gRPC call with a timeout
  return new Promise((resolve, reject) => {
    const deadline = new Date(Date.now() + timeoutMilliseconds);

    client.createRecord(request, { deadline }, (error, response) => {
      let code;
      if (error) {
        code = error.code;
        console.error(error.details);
        res.status(408).json(error.details);
      } else {
        code = grpc.status.OK;
        console.log(`Received gRPC response for createRecord: ${JSON.stringify(response)}`);
        res.json(response);
      }
      resolve();
    });
  });
});

app.put('/records/:record_id', (req, res) => {
  const { record_id } = req.params;
  const { updated_medical_history } = req.body;

  // Convert RESTful request to gRPC request
  const request = { record_id, updated_medical_history };
  console.log(request);
  // Create a gRPC client
  const client = new recordsService.RecordService('localhost:50051', grpc.credentials.createInsecure());

  const timeoutMilliseconds = 5000; // 5 seconds
  // Wrap the gRPC call with a timeout
  return new Promise((resolve, reject) => {
    const deadline = new Date(Date.now() + timeoutMilliseconds);

    client.updateRecordInfo(request, { deadline }, (error, response) => {
      let code;
      if (error) {
        code = error.code;
        console.error(error.details);
        res.status(408).json(error.details)
      } else {
        code = grpc.status.OK;
        console.log(`Received gRPC response for updateRecordInfo: ${JSON.stringify(response)}`);
        res.json(response);
      }
      resolve();
    });
  });
});

app.delete('/records/:record_id', (req, res) => {
  const { record_id } = req.params;

  // Convert RESTful request to gRPC request
  const request = { record_id };

  // Create a gRPC client
  const client = new recordsService.RecordService('localhost:50051', grpc.credentials.createInsecure());

  const timeoutMilliseconds = 5000; // 5 seconds
  // Wrap the gRPC call with a timeout
  return new Promise((resolve, reject) => {
    const deadline = new Date(Date.now() + timeoutMilliseconds);

    client.deleteRecord(request, { deadline }, (error) => {
      if (error) {
        console.error(error.details);
        res.status(408).json(error.details)
      } else {
        console.log(`Successfully deleted record with ID: ${record_id}`);
        res.json(`Successfully deleted record with ID: ${record_id}`);
      }
      resolve();
    });
  });
});

app.post('/prescriptions', (req, res) => {
  const { medication } = req.body;
  console.log(medication);
  // Convert RESTful request to gRPC request
  const request = { medication };
  console.log(request);
  // Create a gRPC client
  const client = new prescriptionService.PrescriptionService('localhost:50052', grpc.credentials.createInsecure());

  // Wrap the gRPC call with a timeout
  return new Promise((resolve, reject) => {
    const timeoutMilliseconds = 5000; // 5 seconds
    const deadline = new Date(Date.now() + timeoutMilliseconds);

    client.CreatePrescription(request, { deadline }, (error, response) => {
      if (error) {
        console.error(error.details);
        res.status(408).json(error.details);
      } else {
        code = grpc.status.OK;
        console.log(`Received gRPC response for createPrescription: ${JSON.stringify(response)}`);
        res.json(response);
      }
      resolve();
    });
  });
});

app.get('/prescriptions/:prescription_id', (req, res) => {
  const { prescription_id } = req.params;

  // Convert RESTful request to gRPC request
  const request = { prescription_id };

  // Create a gRPC client
  const client = new prescriptionService.PrescriptionService('localhost:50052', grpc.credentials.createInsecure());

  const timeoutMilliseconds = 100; // 5 seconds

  // Wrap the gRPC call with a timeout
  return new Promise((resolve, reject) => {
    const deadline = new Date();
    deadline.setMilliseconds(deadline.getMilliseconds()+ timeoutMilliseconds);

    client.getPrescription(request, {deadline}, (error, response) => {
      let code;
      if (error) {
        code = error.code;
        console.error(error.details);
        res.status(408).json(error.details);
      } else {
        code = grpc.status.OK;
        console.log(`Received gRPC response for getPrescription: ${JSON.stringify(response)}`);
        res.json(response);
      }
      resolve();
    });
  });
});

app.put('/prescriptions/:prescription_id', (req, res) => {
  const { prescription_id } = req.params;
  const { updated_medication } = req.body;

  // Convert RESTful request to gRPC request
  const request = { prescription_id, updated_medication };
  console.log(request);
  // Create a gRPC client
  const client = new prescriptionService.PrescriptionService('localhost:50052', grpc.credentials.createInsecure());

  const timeoutMilliseconds = 5000; // 5 seconds
  // Wrap the gRPC call with a timeout
  return new Promise((resolve, reject) => {
    const deadline = new Date(Date.now() + timeoutMilliseconds);

    client.UpdatePrescription(request, { deadline }, (error, response) => {
      let code;
      if (error) {
        code = error.code;
        console.error(error.details);
        res.status(408).json(error.details);
      } else {
        code = grpc.status.OK;
        console.log(`Received gRPC response for updatePrescription: ${JSON.stringify(response)}`);
        res.json(response);
      }
      resolve();
    });
  });
});

app.delete('/prescriptions/:prescription_id', (req, res) => {
  const { prescription_id } = req.params;

  // Convert RESTful request to gRPC request
  const request = { prescription_id };

  // Create a gRPC client
  const client = new prescriptionService.PrescriptionService('localhost:50052', grpc.credentials.createInsecure());

  const timeoutMilliseconds = 5000; // 5 seconds
  // Wrap the gRPC call with a timeout
  return new Promise((resolve, reject) => {
    const deadline = new Date(Date.now() + timeoutMilliseconds);

    client.deletePrescription(request, { deadline }, (error) => {
      if (error) {
        console.error(error.details);
        res.status(408).json(error.details)
      } else {
        console.log(`Successfully deleted prescription with ID: ${prescription_id}`);
        res.json(`Successfully deleted prescription with ID: ${prescription_id}`);
      }
      resolve();
    });
  });
});


// Start the HTTP server for the client
const gatewayPort = 8080;
app.listen(gatewayPort, () => {
  console.log(`Gateway server is running on port ${gatewayPort}`);
});

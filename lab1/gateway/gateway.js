
const { loadSync } = require('@grpc/proto-loader');
const grpc = require('@grpc/grpc-js');

// Load the proto files
const packageDefinition = loadSync([
    '../protobufs/records.proto',
    '../protobufs/prescription.proto',
  ]);

// Create gRPC clients
const recordsService = grpc.loadPackageDefinition(packageDefinition).records;
const prescriptionService = grpc.loadPackageDefinition(packageDefinition).prescription;

function getPatientInfo(patientId) {
  const client = new recordsService.PatientRecordsService('localhost:50051', grpc.credentials.createInsecure());
  const request = { patientId: patientId };

  return new Promise((resolve, reject) => {
    client.getPatientInfo(request, (error, response) => {
      if (!error) {
        resolve(response);
      } else {
        reject(error);
      }
    });
  });
}

function sendPrescriptionToMail(patientId, medication, email) {
  const client = new prescriptionService.PrescriptionManagementService('localhost:50052', grpc.credentials.createInsecure());
  const request = { patientId: patientId, medication: medication };

  return new Promise((resolve, reject) => {
    client.createPrescription(request, (error, response) => {
      if (!error) {
        // Implement logic to send prescription to email here
        resolve(response);
      } else {
        reject(error);
      }
    });
  });
}

// Example usage
const patientId = '1';
const medication = 'Painkiller';
const email = 'example@example.com';

sendPrescriptionToMail(patientId, medication, email)
  .then((prescription) => {
    console.log('Prescription Information:');
    console.log(`ID: ${prescription.id}`);
    console.log(`Patient ID: ${prescription.patientId}`);
    console.log(`Medication: ${prescription.medication}`);
  })
  .catch((error) => {
    console.error(`Failed to create and send prescription for patient ${patientId}:`, error);
  });

getPatientInfo(patientId)
  .then((patient) => {
    console.log('Patient Information:');
    console.log(`ID: ${patient.id}`);
    console.log(`Name: ${patient.name}`);
    console.log(`Medical History: ${patient.medicalHistory}`);
  })
  .catch((error) => {
    console.error(`Patient with ID ${patientId} not found:`, error);
  });
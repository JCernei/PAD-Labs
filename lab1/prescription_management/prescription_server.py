import grpc
from concurrent import futures
import prescription_pb2
import prescription_pb2_grpc

class PrescriptionManagementService(prescription_pb2_grpc.PrescriptionManagementServiceServicer):
    def CreatePrescription(self, request, context):
        print(f"Received CreatePrescription request for patient ID: {request.patient_id}, Medication: {request.medication}")
        # Implement logic to create a prescription
        # Return the created prescription
        response = prescription_pb2.Prescription(id="1", patient_id=request.patient_id, medication=request.medication)
        return response

    def SendPrescriptionByEmail(self, request, context):
        print(f"Received SendPrescriptionByEmail request for prescription ID: {request.prescription_id}, Email: {request.email}")
        # Implement logic to send a prescription by email
        # Return the sent prescription
        response = prescription_pb2.Prescription(id=request.prescription_id, patient_id="1", medication="Some medication")
        return response

def run_server():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    prescription_pb2_grpc.add_PrescriptionManagementServiceServicer_to_server(PrescriptionManagementService(), server)
    server.add_insecure_port('[::]:50052')
    server.start()
    print("Prescription Management Service started.")
    server.wait_for_termination()

if __name__ == '__main__':
    run_server()
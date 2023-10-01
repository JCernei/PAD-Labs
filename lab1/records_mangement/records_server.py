import grpc
from concurrent import futures
import records_pb2
import records_pb2_grpc

class PatientRecordsService(records_pb2_grpc.PatientRecordsServiceServicer):
    def GetPatientInfo(self, request, context):
        print(f"Received GetPatientInfo request for patient ID: {request.patient_id}")
        # Implement logic to retrieve patient info
        response = records_pb2.Patient(id="1", name="John Doe", medical_history="Some medical history")
        return response

    def UpdatePatientInfo(self, request, context):
        print(f"Received UpdatePatientInfo request for patient ID: {request.patient_id}")
        # Implement logic to update patient info
        # Return the updated patient info
        response = records_pb2.Patient(id=request.patient_id, medical_history=request.updated_medical_history)
        return response

def run_server():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    records_pb2_grpc.add_PatientRecordsServiceServicer_to_server(PatientRecordsService(), server)
    server.add_insecure_port('[::]:50051')
    server.start()
    print("Patient Records Service started.")
    server.wait_for_termination()

if __name__ == '__main__':
    run_server()
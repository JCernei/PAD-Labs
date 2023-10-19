import grpc
from concurrent import futures
import prescription_pb2
import prescription_pb2_grpc
from registration_pb2 import ServiceRegistration, DeregisterServiceRequest, SendServiceStatusRequest, Heartbeat
from registration_pb2_grpc import RegistrationServiceStub
import sqlite3
from concurrent import futures
from google.protobuf import empty_pb2
import threading
import time
import os
from dotenv import load_dotenv
import sys

load_dotenv()
# PRESCRIPTION_SERVICE_PORT = int(os.getenv("PRESCRIPTION_SERVICE_PORT"))
SERVICE_DISCOVERY_URL = os.getenv("SERVICE_DISCOVERY_URL")

SERVICE_NAME = "prescriptions-service"
SERVICE_HOST = "0.0.0.0"

DATABASE = "prescriptions.db"

connection = sqlite3.connect(DATABASE)
cursor = connection.cursor()
cursor.execute('''
        CREATE TABLE IF NOT EXISTS prescriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            medication TEXT
        )
    ''')
connection.commit()
cursor.close

load_counter = 1

def increase_load():
    global load_counter
    load_counter += 1

def decrease_load():
    global load_counter
    load_counter -= 1

def register_service(PRESCRIPTION_SERVICE_PORT):
    with grpc.insecure_channel(SERVICE_DISCOVERY_URL) as channel:
        stub = RegistrationServiceStub(channel)
        registration_info = ServiceRegistration(
            name=SERVICE_NAME,
            host=SERVICE_HOST,
            port=PRESCRIPTION_SERVICE_PORT  # The port where your Python service listens
        )
        stub.RegisterService(registration_info)
        print("Service registered with the Node.js gateway")

def deregister_service(PRESCRIPTION_SERVICE_PORT):
    with grpc.insecure_channel(SERVICE_DISCOVERY_URL) as channel:
        stub = RegistrationServiceStub(channel)
        deregistration_request = DeregisterServiceRequest(
            name=SERVICE_NAME,
            host=SERVICE_HOST,
            port=PRESCRIPTION_SERVICE_PORT  # The port where your Python service listens
        )
    stub.DeregisterService(deregistration_request)

    return empty_pb2.Empty()

def update_service_status(PRESCRIPTION_SERVICE_PORT):
    global load_counter
    with grpc.insecure_channel(SERVICE_DISCOVERY_URL) as channel:
        stub = RegistrationServiceStub(channel)
        status_request = SendServiceStatusRequest(
            service_name=SERVICE_NAME,
            port=PRESCRIPTION_SERVICE_PORT,
            load=load_counter
        )
        stub.UpdateServiceStatus(status_request)
        print(f"Service status updated {load_counter}")

def update_service_heartbeat(PRESCRIPTION_SERVICE_PORT):
    with grpc.insecure_channel(SERVICE_DISCOVERY_URL) as channel:
        stub = RegistrationServiceStub(channel)
        heartbeat = Heartbeat(
            service_name=SERVICE_NAME,
            port=PRESCRIPTION_SERVICE_PORT
        )
        stub.UpdateServiceHeartbeat(heartbeat)
        print("Service heartbeat updated")
        
def update_service_status_and_heartbeat_periodically(PRESCRIPTION_SERVICE_PORT):
    while True:
        try:
            update_service_status(PRESCRIPTION_SERVICE_PORT)
            update_service_heartbeat(PRESCRIPTION_SERVICE_PORT)
            print("Service status and heartbeat sent")
        except Exception as e:
            print(f"Failed to send status and heartbeat: {e}")

        # Adjust the sleep interval (in seconds) as needed
        time.sleep(1)

class PrescriptionServicer(prescription_pb2_grpc.PrescriptionServiceServicer):
    def CreatePrescription(self, request, context):
        increase_load()
        connection = sqlite3.connect(DATABASE)
        cursor = connection.cursor()
        print(request.medication)
        
        cursor.execute(
            "INSERT INTO prescriptions (medication) VALUES (?)",
            (request.medication,)
        )

        connection.commit()

        prescription_id = cursor.lastrowid

        connection.close()
        
        prescription = prescription_pb2.Prescription(
            id=str(prescription_id),
            medication=request.medication
        )
        decrease_load()
        return prescription

    def GetPrescription(self, request, context):
        increase_load()
        connection = sqlite3.connect(DATABASE)
        cursor = connection.cursor()

        cursor.execute(
            "SELECT id, medication FROM prescriptions WHERE id = ?",
            (request.prescription_id,)
        )

        result = cursor.fetchone()
        connection.close()

        if result:
            prescription = prescription_pb2.Prescription(
                id=str(result[0]),
                medication=result[1]
            )
            decrease_load()
            return prescription
        else:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details("Prescription not found")
            decrease_load()
            return prescription_pb2.Prescription()

    def UpdatePrescription(self, request, context):
        increase_load()
        connection = sqlite3.connect(DATABASE)
        cursor = connection.cursor()

        cursor.execute(
            "UPDATE prescriptions SET medication = ? WHERE id = ?",
            (request.updated_medication, request.prescription_id)
        )

        connection.commit()
        connection.close()
        print(request.updated_medication)
        print(request.prescription_id)
        # Return the updated prescription
        prescription = prescription_pb2.Prescription(
            id=request.prescription_id,
            medication=request.updated_medication
        )
        decrease_load()
        return prescription

    def DeletePrescription(self, request, context):
        increase_load()
        connection = sqlite3.connect(DATABASE)
        cursor = connection.cursor()

        cursor.execute(
            "DELETE FROM prescriptions WHERE id = ?",
            (request.prescription_id,)
        )

        connection.commit()
        connection.close()

        decrease_load()
        return empty_pb2.Empty()

    def SendPrescriptionByEmail(self, request, context):
        # increase_load()
        return empty_pb2.Empty()

    def GetServiceStatus(self, request, context):
        # increase_load()
        return prescription_pb2.ServiceStatus(is_healthy=True)

def serve(PRESCRIPTION_SERVICE_PORT):
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    prescription_pb2_grpc.add_PrescriptionServiceServicer_to_server(PrescriptionServicer(), server)
    server.add_insecure_port(f'[::]:{PRESCRIPTION_SERVICE_PORT}')
    server.start()
    print(f"Server started on port {PRESCRIPTION_SERVICE_PORT}")
    server.wait_for_termination()

if __name__ == '__main__':
    PRESCRIPTION_SERVICE_PORT = int(sys.argv[1])

    register_service(PRESCRIPTION_SERVICE_PORT)
    status_heartbeat_thread = threading.Thread(target=update_service_status_and_heartbeat_periodically, args=(PRESCRIPTION_SERVICE_PORT,))
    status_heartbeat_thread.daemon = True
    status_heartbeat_thread.start()

    serve(PRESCRIPTION_SERVICE_PORT)

import grpc
import records_pb2
import records_pb2_grpc
from registration_pb2 import ServiceRegistration, DeregisterServiceRequest, SendServiceStatusRequest, Heartbeat
from registration_pb2_grpc import RegistrationServiceStub
import sqlite3
from concurrent import futures
from google.protobuf import empty_pb2
import threading
import time
import os
from dotenv import load_dotenv

load_dotenv()
# RECORDS_SERVICE_PORT = None
# print(RECORDS_SERVICE_PORT)
SERVICE_NAME = "records-service"
SERVICE_HOSTNAME = os.getenv("RECORDS_SERVICE_HOSTNAME")
RECORDS_SERVICE_PORT = os.getenv("RECORDS_SERVICE_PORT")

SERVICE_DISCOVERY_HOSTNAME = os.getenv("SERVICE_DISCOVERY_HOSTNAME")
SERVICE_DISCOVERY_PORT = os.getenv("SERVICE_DISCOVERY_PORT")
SERVICE_DISCOVERY_URL = f"{SERVICE_DISCOVERY_HOSTNAME}:{SERVICE_DISCOVERY_PORT}"
print(SERVICE_DISCOVERY_HOSTNAME)

DATABASE = "records.db"

connection = sqlite3.connect(DATABASE)
cursor = connection.cursor()
cursor.execute('''
        CREATE TABLE IF NOT EXISTS records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            medical_history TEXT
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

def register_service(RECORDS_SERVICE_PORT):
    with grpc.insecure_channel(SERVICE_DISCOVERY_URL) as channel:
        stub = RegistrationServiceStub(channel)
        registration_info = ServiceRegistration(
            name=SERVICE_NAME,
            host=SERVICE_HOSTNAME,
            port=RECORDS_SERVICE_PORT  # The port where your Python service listens
        )
        stub.RegisterService(registration_info)
        print("Service registered with the Node.js gateway")

def deregister_service(RECORDS_SERVICE_PORT):
    with grpc.insecure_channel(SERVICE_DISCOVERY_URL) as channel:
        stub = RegistrationServiceStub(channel)
        deregistration_request = DeregisterServiceRequest(
            name=SERVICE_NAME,
            host=SERVICE_HOSTNAME,
            port=RECORDS_SERVICE_PORT  # The port where your Python service listens
        )
    stub.DeregisterService(deregistration_request)

    return empty_pb2.Empty()

def update_service_status(RECORDS_SERVICE_PORT):
    global load_counter
    with grpc.insecure_channel(SERVICE_DISCOVERY_URL) as channel:
        stub = RegistrationServiceStub(channel)
        status_request = SendServiceStatusRequest(
            service_name=SERVICE_NAME,
            port=RECORDS_SERVICE_PORT,
            load=load_counter
        )
        stub.UpdateServiceStatus(status_request)
        print(f"Service status updated {load_counter}")

def update_service_heartbeat(RECORDS_SERVICE_PORT):
    with grpc.insecure_channel(SERVICE_DISCOVERY_URL) as channel:
        stub = RegistrationServiceStub(channel)
        heartbeat = Heartbeat(
            service_name=SERVICE_NAME,
            port=RECORDS_SERVICE_PORT
        )
        stub.UpdateServiceHeartbeat(heartbeat)
        print("Service heartbeat updated")
        
def update_service_status_and_heartbeat_periodically(RECORDS_SERVICE_PORT):
    while True:
        try:
            update_service_status(RECORDS_SERVICE_PORT)
            update_service_heartbeat(RECORDS_SERVICE_PORT)
            print("Service status and heartbeat sent")
        except Exception as e:
            print(f"Failed to send status and heartbeat: {e}")

        # Adjust the sleep interval (in seconds) as needed
        time.sleep(1)

class RecordService(records_pb2_grpc.RecordServiceServicer):
    def CreateRecord(self, request, context):
        increase_load()
        connection = sqlite3.connect(DATABASE)
        cursor = connection.cursor()

        cursor.execute(
            "INSERT INTO records (name, medical_history) VALUES (?, ?)",
            (request.name, request.medical_history,)
        )

        connection.commit()

        record_id = cursor.lastrowid
        cursor.close()
        print('creating new record')
        print(request.medical_history)
        record = records_pb2.Record(
            id=str(record_id),
            name=request.name,
            medical_history=request.medical_history
        )

        decrease_load()
        return record

    def GetRecordInfo(self, request, context):
        increase_load()
        connection = sqlite3.connect(DATABASE)
        cursor = connection.cursor()
        
        cursor.execute(
            "SELECT id, name, medical_history FROM records WHERE id = ?",
            (int(request.record_id),)
        )

        result = cursor.fetchone()
        cursor.close()

        print(request)

        if result:
            record = records_pb2.Record(
                id=str(result[0]),
                name=result[1],
                medical_history=result[2]
            )
            time.sleep(2)
            decrease_load()
            return record
        else:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(f"Record with ID {request.record_id} not found.")

            time.sleep(2)
            decrease_load()
            return records_pb2.Record()
        
    def UpdateRecordInfo(self, request, context):
        increase_load()
        connection = sqlite3.connect(DATABASE)
        cursor = connection.cursor()
        print(request.record_id)
        cursor.execute(
            "UPDATE records SET medical_history = ? WHERE id = ?",
            (request.updated_medical_history, int(request.record_id))
        )

        connection.commit()
        cursor.close()
        print(request.updated_medical_history)
        record = records_pb2.Record(
            id=request.record_id,
            name='',  # Return an empty name as it was not updated
            medical_history=request.updated_medical_history
        )
        decrease_load()
        return record

    def DeleteRecord(self, request, context):
        increase_load()
        connection = sqlite3.connect(DATABASE)
        cursor = connection.cursor()

        cursor.execute(
            "DELETE FROM records WHERE id = ?",
            (int(request.record_id),)
        )

        connection.commit()
        cursor.close()
        decrease_load()
        return empty_pb2.Empty()

    def ListRecords(self, request, context):
        increase_load()
        connection = sqlite3.connect(DATABASE)
        cursor = connection.cursor()

        cursor.execute("SELECT id, name, medical_history FROM records")

        records = [records_pb2.Record(
            id=str(row[0]),
            name=row[1],
            medical_history=row[2]
        ) for row in cursor.fetchall()]

        cursor.close()
        decrease_load()
        return records_pb2.ListRecordsResponse(records=records)
    
    def GetServiceStatus(self, request, context):
        # increase_load()
        return records_pb2.ServiceStatus(is_healthy=True)


def serve(RECORDS_SERVICE_PORT):
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    records_pb2_grpc.add_RecordServiceServicer_to_server(RecordService(), server)
    server.add_insecure_port(f'[::]:{RECORDS_SERVICE_PORT}')
    server.start()
    print(f"Server started on port {RECORDS_SERVICE_PORT}")
    server.wait_for_termination()

if __name__ == '__main__':
    # RECORDS_SERVICE_PORT = int(sys.argv[1])
    RECORDS_SERVICE_PORT = 50051
    register_service(RECORDS_SERVICE_PORT)
    status_heartbeat_thread = threading.Thread(target=update_service_status_and_heartbeat_periodically, args=(RECORDS_SERVICE_PORT,))
    status_heartbeat_thread.daemon = True
    status_heartbeat_thread.start()
    serve(RECORDS_SERVICE_PORT)

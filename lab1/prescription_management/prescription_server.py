import grpc
from concurrent import futures
import prescription_pb2
import prescription_pb2_grpc
import sqlite3
from google.protobuf import empty_pb2

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

class PrescriptionServicer(prescription_pb2_grpc.PrescriptionServiceServicer):
    def CreatePrescription(self, request, context):
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
            id=str(prescription_id),  # Replace with a unique ID
            medication=request.medication
        )
        return prescription

    def GetPrescription(self, request, context):
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
            return prescription
        else:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details("Prescription not found")
            return prescription_pb2.Prescription()

    def UpdatePrescription(self, request, context):
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
        return prescription

    def DeletePrescription(self, request, context):
        connection = sqlite3.connect(DATABASE)
        cursor = connection.cursor()

        cursor.execute(
            "DELETE FROM prescriptions WHERE id = ?",
            (request.prescription_id,)
        )

        connection.commit()
        connection.close()

        # Return an empty response
        return empty_pb2.Empty()

    def SendPrescriptionByEmail(self, request, context):
        return empty_pb2.Empty()

    def GetServiceStatus(self, request, context):
        return prescription_pb2.ServiceStatus(is_healthy=True)

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    prescription_pb2_grpc.add_PrescriptionServiceServicer_to_server(PrescriptionServicer(), server)
    server.add_insecure_port('[::]:50052')
    server.start()
    print("Server started on port 50052")
    server.wait_for_termination()

if __name__ == '__main__':
    serve()

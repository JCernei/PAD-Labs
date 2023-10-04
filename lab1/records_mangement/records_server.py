import grpc
import records_pb2
import records_pb2_grpc
import sqlite3
from concurrent import futures
from google.protobuf import empty_pb2


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

class RecordService(records_pb2_grpc.RecordServiceServicer):
    def CreateRecord(self, request, context):
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
        return record

    def GetRecordInfo(self, request, context):
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
            return record
        else:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(f"Record with ID {request.record_id} not found.")
            return records_pb2.Record()
        
    def UpdateRecordInfo(self, request, context):
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
        return record

    def DeleteRecord(self, request, context):
        connection = sqlite3.connect(DATABASE)
        cursor = connection.cursor()

        cursor.execute(
            "DELETE FROM records WHERE id = ?",
            (int(request.record_id),)
        )

        connection.commit()
        cursor.close()

        return empty_pb2.Empty()

    def ListRecords(self, request, context):
        connection = sqlite3.connect(DATABASE)
        cursor = connection.cursor()

        cursor.execute("SELECT id, name, medical_history FROM records")

        records = [records_pb2.Record(
            id=str(row[0]),
            name=row[1],
            medical_history=row[2]
        ) for row in cursor.fetchall()]

        cursor.close()

        return records_pb2.ListRecordsResponse(records=records)

    def GetServiceStatus(self, request, context):
        return records_pb2.ServiceStatus(is_healthy=True)

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    records_pb2_grpc.add_RecordServiceServicer_to_server(RecordService(), server)
    server.add_insecure_port('[::]:50051')
    server.start()
    print("Server started on port 50051")
    server.wait_for_termination()

if __name__ == '__main__':
    serve()

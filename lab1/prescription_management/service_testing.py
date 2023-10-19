import unittest
import grpc
import prescription_pb2
import prescription_pb2_grpc
from prescription_server import PrescriptionServicer
from concurrent import futures

class TestPrescriptionService(unittest.TestCase):
    def setUp(self):
        self.server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
        prescription_pb2_grpc.add_PrescriptionServiceServicer_to_server(
            PrescriptionServicer(), self.server)
        self.server.add_insecure_port('[::]:50051')  # Use the correct port
        self.server.start()
        self.channel = grpc.insecure_channel('localhost:50051')  # Use the correct host and port
        self.stub = prescription_pb2_grpc.PrescriptionServiceStub(self.channel)

    def tearDown(self):
        # Stop the gRPC server
        self.server.stop(0)

    # Write test methods for the service's functionality
    def test_CreatePrescription(self):
        # Create a request
        request = prescription_pb2.CreatePrescriptionRequest(medication="MedicationName")

        # Call the service method
        response = self.stub.CreatePrescription(request)

        # Assert the response and test for correctness
        self.assertEqual(response.medication, "MedicationName")

    def test_GetPrescription(self):
        # Create a request
        request = prescription_pb2.GetPrescriptionRequest(prescription_id="6")

        # Call the service method
        response = self.stub.GetPrescription(request)

        # Assert the response and test for correctness
        self.assertEqual(response.id, "6")


if __name__ == '__main__':
    unittest.main()
# Generated by the gRPC Python protocol compiler plugin. DO NOT EDIT!
"""Client and server classes corresponding to protobuf-defined services."""
import grpc

from google.protobuf import empty_pb2 as google_dot_protobuf_dot_empty__pb2
import prescription_pb2 as prescription__pb2


class PrescriptionServiceStub(object):
    """Missing associated documentation comment in .proto file."""

    def __init__(self, channel):
        """Constructor.

        Args:
            channel: A grpc.Channel.
        """
        self.CreatePrescription = channel.unary_unary(
                '/prescription.PrescriptionService/CreatePrescription',
                request_serializer=prescription__pb2.CreatePrescriptionRequest.SerializeToString,
                response_deserializer=prescription__pb2.Prescription.FromString,
                )
        self.GetPrescription = channel.unary_unary(
                '/prescription.PrescriptionService/GetPrescription',
                request_serializer=prescription__pb2.GetPrescriptionRequest.SerializeToString,
                response_deserializer=prescription__pb2.Prescription.FromString,
                )
        self.UpdatePrescription = channel.unary_unary(
                '/prescription.PrescriptionService/UpdatePrescription',
                request_serializer=prescription__pb2.UpdatePrescriptionRequest.SerializeToString,
                response_deserializer=prescription__pb2.Prescription.FromString,
                )
        self.DeletePrescription = channel.unary_unary(
                '/prescription.PrescriptionService/DeletePrescription',
                request_serializer=prescription__pb2.DeletePrescriptionRequest.SerializeToString,
                response_deserializer=google_dot_protobuf_dot_empty__pb2.Empty.FromString,
                )
        self.SendPrescriptionByEmail = channel.unary_unary(
                '/prescription.PrescriptionService/SendPrescriptionByEmail',
                request_serializer=prescription__pb2.SendPrescriptionByEmailRequest.SerializeToString,
                response_deserializer=google_dot_protobuf_dot_empty__pb2.Empty.FromString,
                )
        self.GetServiceStatus = channel.unary_unary(
                '/prescription.PrescriptionService/GetServiceStatus',
                request_serializer=google_dot_protobuf_dot_empty__pb2.Empty.SerializeToString,
                response_deserializer=prescription__pb2.ServiceStatus.FromString,
                )


class PrescriptionServiceServicer(object):
    """Missing associated documentation comment in .proto file."""

    def CreatePrescription(self, request, context):
        """Missing associated documentation comment in .proto file."""
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details('Method not implemented!')
        raise NotImplementedError('Method not implemented!')

    def GetPrescription(self, request, context):
        """Missing associated documentation comment in .proto file."""
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details('Method not implemented!')
        raise NotImplementedError('Method not implemented!')

    def UpdatePrescription(self, request, context):
        """Missing associated documentation comment in .proto file."""
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details('Method not implemented!')
        raise NotImplementedError('Method not implemented!')

    def DeletePrescription(self, request, context):
        """Missing associated documentation comment in .proto file."""
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details('Method not implemented!')
        raise NotImplementedError('Method not implemented!')

    def SendPrescriptionByEmail(self, request, context):
        """Missing associated documentation comment in .proto file."""
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details('Method not implemented!')
        raise NotImplementedError('Method not implemented!')

    def GetServiceStatus(self, request, context):
        """Missing associated documentation comment in .proto file."""
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details('Method not implemented!')
        raise NotImplementedError('Method not implemented!')


def add_PrescriptionServiceServicer_to_server(servicer, server):
    rpc_method_handlers = {
            'CreatePrescription': grpc.unary_unary_rpc_method_handler(
                    servicer.CreatePrescription,
                    request_deserializer=prescription__pb2.CreatePrescriptionRequest.FromString,
                    response_serializer=prescription__pb2.Prescription.SerializeToString,
            ),
            'GetPrescription': grpc.unary_unary_rpc_method_handler(
                    servicer.GetPrescription,
                    request_deserializer=prescription__pb2.GetPrescriptionRequest.FromString,
                    response_serializer=prescription__pb2.Prescription.SerializeToString,
            ),
            'UpdatePrescription': grpc.unary_unary_rpc_method_handler(
                    servicer.UpdatePrescription,
                    request_deserializer=prescription__pb2.UpdatePrescriptionRequest.FromString,
                    response_serializer=prescription__pb2.Prescription.SerializeToString,
            ),
            'DeletePrescription': grpc.unary_unary_rpc_method_handler(
                    servicer.DeletePrescription,
                    request_deserializer=prescription__pb2.DeletePrescriptionRequest.FromString,
                    response_serializer=google_dot_protobuf_dot_empty__pb2.Empty.SerializeToString,
            ),
            'SendPrescriptionByEmail': grpc.unary_unary_rpc_method_handler(
                    servicer.SendPrescriptionByEmail,
                    request_deserializer=prescription__pb2.SendPrescriptionByEmailRequest.FromString,
                    response_serializer=google_dot_protobuf_dot_empty__pb2.Empty.SerializeToString,
            ),
            'GetServiceStatus': grpc.unary_unary_rpc_method_handler(
                    servicer.GetServiceStatus,
                    request_deserializer=google_dot_protobuf_dot_empty__pb2.Empty.FromString,
                    response_serializer=prescription__pb2.ServiceStatus.SerializeToString,
            ),
    }
    generic_handler = grpc.method_handlers_generic_handler(
            'prescription.PrescriptionService', rpc_method_handlers)
    server.add_generic_rpc_handlers((generic_handler,))


 # This class is part of an EXPERIMENTAL API.
class PrescriptionService(object):
    """Missing associated documentation comment in .proto file."""

    @staticmethod
    def CreatePrescription(request,
            target,
            options=(),
            channel_credentials=None,
            call_credentials=None,
            insecure=False,
            compression=None,
            wait_for_ready=None,
            timeout=None,
            metadata=None):
        return grpc.experimental.unary_unary(request, target, '/prescription.PrescriptionService/CreatePrescription',
            prescription__pb2.CreatePrescriptionRequest.SerializeToString,
            prescription__pb2.Prescription.FromString,
            options, channel_credentials,
            insecure, call_credentials, compression, wait_for_ready, timeout, metadata)

    @staticmethod
    def GetPrescription(request,
            target,
            options=(),
            channel_credentials=None,
            call_credentials=None,
            insecure=False,
            compression=None,
            wait_for_ready=None,
            timeout=None,
            metadata=None):
        return grpc.experimental.unary_unary(request, target, '/prescription.PrescriptionService/GetPrescription',
            prescription__pb2.GetPrescriptionRequest.SerializeToString,
            prescription__pb2.Prescription.FromString,
            options, channel_credentials,
            insecure, call_credentials, compression, wait_for_ready, timeout, metadata)

    @staticmethod
    def UpdatePrescription(request,
            target,
            options=(),
            channel_credentials=None,
            call_credentials=None,
            insecure=False,
            compression=None,
            wait_for_ready=None,
            timeout=None,
            metadata=None):
        return grpc.experimental.unary_unary(request, target, '/prescription.PrescriptionService/UpdatePrescription',
            prescription__pb2.UpdatePrescriptionRequest.SerializeToString,
            prescription__pb2.Prescription.FromString,
            options, channel_credentials,
            insecure, call_credentials, compression, wait_for_ready, timeout, metadata)

    @staticmethod
    def DeletePrescription(request,
            target,
            options=(),
            channel_credentials=None,
            call_credentials=None,
            insecure=False,
            compression=None,
            wait_for_ready=None,
            timeout=None,
            metadata=None):
        return grpc.experimental.unary_unary(request, target, '/prescription.PrescriptionService/DeletePrescription',
            prescription__pb2.DeletePrescriptionRequest.SerializeToString,
            google_dot_protobuf_dot_empty__pb2.Empty.FromString,
            options, channel_credentials,
            insecure, call_credentials, compression, wait_for_ready, timeout, metadata)

    @staticmethod
    def SendPrescriptionByEmail(request,
            target,
            options=(),
            channel_credentials=None,
            call_credentials=None,
            insecure=False,
            compression=None,
            wait_for_ready=None,
            timeout=None,
            metadata=None):
        return grpc.experimental.unary_unary(request, target, '/prescription.PrescriptionService/SendPrescriptionByEmail',
            prescription__pb2.SendPrescriptionByEmailRequest.SerializeToString,
            google_dot_protobuf_dot_empty__pb2.Empty.FromString,
            options, channel_credentials,
            insecure, call_credentials, compression, wait_for_ready, timeout, metadata)

    @staticmethod
    def GetServiceStatus(request,
            target,
            options=(),
            channel_credentials=None,
            call_credentials=None,
            insecure=False,
            compression=None,
            wait_for_ready=None,
            timeout=None,
            metadata=None):
        return grpc.experimental.unary_unary(request, target, '/prescription.PrescriptionService/GetServiceStatus',
            google_dot_protobuf_dot_empty__pb2.Empty.SerializeToString,
            prescription__pb2.ServiceStatus.FromString,
            options, channel_credentials,
            insecure, call_credentials, compression, wait_for_ready, timeout, metadata)

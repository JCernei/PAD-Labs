# -*- coding: utf-8 -*-
# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: prescription.proto
"""Generated protocol buffer code."""
from google.protobuf import descriptor as _descriptor
from google.protobuf import descriptor_pool as _descriptor_pool
from google.protobuf import symbol_database as _symbol_database
from google.protobuf.internal import builder as _builder
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()




DESCRIPTOR = _descriptor_pool.Default().AddSerializedFile(b'\n\x12prescription.proto\x12\x0cprescription\"B\n\x0cPrescription\x12\n\n\x02id\x18\x01 \x01(\t\x12\x12\n\npatient_id\x18\x02 \x01(\t\x12\x12\n\nmedication\x18\x03 \x01(\t\"C\n\x19\x43reatePrescriptionRequest\x12\x12\n\npatient_id\x18\x01 \x01(\t\x12\x12\n\nmedication\x18\x02 \x01(\t\"H\n\x1eSendPrescriptionByEmailRequest\x12\x17\n\x0fprescription_id\x18\x01 \x01(\t\x12\r\n\x05\x65mail\x18\x02 \x01(\t2\xdf\x01\n\x1dPrescriptionManagementService\x12Y\n\x12\x43reatePrescription\x12\'.prescription.CreatePrescriptionRequest\x1a\x1a.prescription.Prescription\x12\x63\n\x17SendPrescriptionByEmail\x12,.prescription.SendPrescriptionByEmailRequest\x1a\x1a.prescription.Prescriptionb\x06proto3')

_globals = globals()
_builder.BuildMessageAndEnumDescriptors(DESCRIPTOR, _globals)
_builder.BuildTopDescriptorsAndMessages(DESCRIPTOR, 'prescription_pb2', _globals)
if _descriptor._USE_C_DESCRIPTORS == False:
  DESCRIPTOR._options = None
  _globals['_PRESCRIPTION']._serialized_start=36
  _globals['_PRESCRIPTION']._serialized_end=102
  _globals['_CREATEPRESCRIPTIONREQUEST']._serialized_start=104
  _globals['_CREATEPRESCRIPTIONREQUEST']._serialized_end=171
  _globals['_SENDPRESCRIPTIONBYEMAILREQUEST']._serialized_start=173
  _globals['_SENDPRESCRIPTIONBYEMAILREQUEST']._serialized_end=245
  _globals['_PRESCRIPTIONMANAGEMENTSERVICE']._serialized_start=248
  _globals['_PRESCRIPTIONMANAGEMENTSERVICE']._serialized_end=471
# @@protoc_insertion_point(module_scope)
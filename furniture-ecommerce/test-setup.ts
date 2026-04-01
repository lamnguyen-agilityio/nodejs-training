jest.mock('@nestjs/common', () => ({
  ...jest.requireActual('@nestjs/common'),
  UseGuards: jest.fn(() => () => {}),
  applyDecorators: jest.fn(() => () => {}),
  SetMetadata: jest.fn(() => 'SetMetadata'),
}));

jest.mock('@nestjs/swagger', () => ({
  ApiBearerAuth: jest.fn(() => () => {}),
  ApiUnauthorizedResponse: jest.fn(() => () => {}),
  ApiProperty: jest.fn(() => () => {}),
  ApiOperation: jest.fn(() => () => {}),
  ApiOkResponse: jest.fn(() => () => {}),
  ApiBody: jest.fn(() => () => {}),
  ApiForbiddenResponse: jest.fn(() => () => {}),
  ApiTags: jest.fn(() => () => {}),
  ApiPropertyOptional: jest.fn(() => () => {}),
  ApiNotFoundResponse: jest.fn(() => () => {}),
  ApiCreatedResponse: jest.fn(() => () => {}),
  ApiConflictResponse: jest.fn(() => () => {}),
  ApiNoContentResponse: jest.fn(() => () => {}),
  ApiConsumes: jest.fn(() => () => {}),
  ApiBadRequestResponse: jest.fn(() => () => {}),
  ApiUnprocessableEntityResponse: jest.fn(() => () => {}),
}));

jest.mock('jwks-rsa', () => ({
  JwksClient: jest.fn().mockImplementation(() => ({
    getSigningKey: jest.fn(),
  })),
}));

jest.mock('@clerk/backend', () => ({
  createClerkClient: jest.fn(() => ({
    users: { getUser: jest.fn() },
  })),
  verifyToken: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

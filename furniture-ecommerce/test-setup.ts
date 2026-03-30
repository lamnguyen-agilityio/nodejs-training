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
}));

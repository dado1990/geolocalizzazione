# API Specification - Bus Tracker System

## OpenAPI 3.0 Specification

```yaml
openapi: 3.0.3
info:
  title: Bus Tracker API
  description: API per sistema di tracciamento autobus in tempo reale
  version: 1.0.0
  contact:
    email: tech@bustracker.example.com

servers:
  - url: https://api.bustracker.example.com/v1
    description: Production
  - url: https://staging-api.bustracker.example.com/v1
    description: Staging
  - url: http://localhost:3000/v1
    description: Local Development

tags:
  - name: Device
    description: Endpoints per dispositivi a bordo bus
  - name: Telemetry
    description: Invio e recupero dati telemetria
  - name: Fleet
    description: Gestione flotta e monitoraggio real-time
  - name: Lines
    description: Gestione linee
  - name: Routes
    description: Gestione percorsi
  - name: Stops
    description: Gestione fermate
  - name: Buses
    description: Gestione autobus
  - name: Users
    description: Gestione utenti e ruoli
  - name: Auth
    description: Autenticazione e autorizzazione

components:
  securitySchemes:
    DeviceToken:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: Token JWT per dispositivi
    UserToken:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: Token JWT per utenti (Admin/Operator)

  schemas:
    Error:
      type: object
      required:
        - error
        - message
      properties:
        error:
          type: string
          example: VALIDATION_ERROR
        message:
          type: string
          example: Invalid input data
        details:
          type: object
          additionalProperties: true
        timestamp:
          type: string
          format: date-time
          example: 2026-02-03T14:30:00Z

    DeviceRegistration:
      type: object
      required:
        - uuid
        - platform
        - app_version
      properties:
        uuid:
          type: string
          format: uuid
          description: UUID generato dal dispositivo
          example: 550e8400-e29b-41d4-a716-446655440000
        platform:
          type: string
          enum: [android, ios]
          example: android
        app_version:
          type: string
          example: 1.2.3
        device_model:
          type: string
          example: Samsung Galaxy S21
        os_version:
          type: string
          example: Android 13
        metadata:
          type: object
          additionalProperties: true

    DeviceRegistrationResponse:
      type: object
      required:
        - device_id
        - token
        - refresh_token
      properties:
        device_id:
          type: integer
          example: 42
        token:
          type: string
          description: JWT access token (valido 30 giorni)
          example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
        refresh_token:
          type: string
          description: Refresh token per rinnovo
          example: rt_550e8400e29b41d4a716446655440000
        config:
          type: object
          description: Configurazione per il dispositivo
          properties:
            location_interval_ms:
              type: integer
              example: 120000
            movement_threshold_meters:
              type: number
              example: 50
            retry_backoff_ms:
              type: integer
              example: 5000

    LocationPayload:
      type: object
      required:
        - latitude
        - longitude
        - accuracy
        - timestamp
      properties:
        latitude:
          type: number
          format: double
          minimum: -90
          maximum: 90
          example: 45.4642
        longitude:
          type: number
          format: double
          minimum: -180
          maximum: 180
          example: 9.1900
        accuracy:
          type: number
          description: Accuratezza in metri
          example: 12.5
        altitude:
          type: number
          nullable: true
          example: 125.3
        speed:
          type: number
          nullable: true
          description: Velocità in m/s
          example: 13.89
        heading:
          type: number
          nullable: true
          description: Direzione in gradi (0-360)
          example: 180
        timestamp:
          type: string
          format: date-time
          description: Timestamp GPS
          example: 2026-02-03T14:25:30Z
        provider:
          type: string
          enum: [gps, network, fused]
          example: gps
        battery_level:
          type: number
          minimum: 0
          maximum: 100
          example: 78
        network_type:
          type: string
          enum: [wifi, cellular, none]
          example: cellular
        nonce:
          type: string
          description: Nonce anti-replay (UUID)
          example: 7c9e6679-7425-40de-944b-e07fc1f90ae7

    LocationResponse:
      type: object
      required:
        - id
        - status
        - received_at
      properties:
        id:
          type: integer
          example: 123456
        status:
          type: string
          enum: [accepted, queued, throttled]
          example: accepted
        received_at:
          type: string
          format: date-time
          example: 2026-02-03T14:25:31Z
        next_expected_at:
          type: string
          format: date-time
          example: 2026-02-03T14:27:31Z

    Bus:
      type: object
      required:
        - id
        - label
        - status
      properties:
        id:
          type: integer
          example: 15
        label:
          type: string
          example: Bus 42
        plate:
          type: string
          example: AB123CD
        device_id:
          type: integer
          nullable: true
          example: 42
        line_id:
          type: integer
          nullable: true
          example: 5
        status:
          type: string
          enum: [active, inactive, maintenance]
          example: active
        metadata:
          type: object
          additionalProperties: true
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    Line:
      type: object
      required:
        - id
        - name
        - code
      properties:
        id:
          type: integer
          example: 5
        name:
          type: string
          example: Linea Centro-Periferia
        code:
          type: string
          example: L05
        color:
          type: string
          description: Colore esadecimale per UI
          example: "#FF5733"
        active:
          type: boolean
          example: true
        description:
          type: string
          nullable: true
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    Route:
      type: object
      required:
        - id
        - line_id
        - name
        - polyline
      properties:
        id:
          type: integer
          example: 10
        line_id:
          type: integer
          example: 5
        name:
          type: string
          example: Percorso A - Andata
        direction:
          type: string
          enum: [outbound, inbound]
          example: outbound
        polyline:
          type: string
          description: Encoded polyline (Google format)
          example: _p~iF~ps|U_ulLnnqC_mqNvxq`@
        stops:
          type: array
          items:
            type: integer
            description: Array di stop_id ordinati
          example: [1, 5, 8, 12]
        active_from:
          type: string
          format: date
          nullable: true
          example: 2026-02-01
        active_to:
          type: string
          format: date
          nullable: true
          example: 2026-12-31
        metadata:
          type: object
          additionalProperties: true
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    Stop:
      type: object
      required:
        - id
        - name
        - latitude
        - longitude
      properties:
        id:
          type: integer
          example: 8
        name:
          type: string
          example: Piazza Duomo
        code:
          type: string
          nullable: true
          example: PD01
        latitude:
          type: number
          format: double
          example: 45.4642
        longitude:
          type: number
          format: double
          example: 9.1900
        address:
          type: string
          nullable: true
          example: Piazza del Duomo, 20122 Milano
        active:
          type: boolean
          example: true
        metadata:
          type: object
          additionalProperties: true
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    LiveBus:
      type: object
      required:
        - bus_id
        - label
        - status
      properties:
        bus_id:
          type: integer
          example: 15
        label:
          type: string
          example: Bus 42
        plate:
          type: string
          example: AB123CD
        line_id:
          type: integer
          example: 5
        line_name:
          type: string
          example: L05
        latitude:
          type: number
          format: double
          nullable: true
          example: 45.4642
        longitude:
          type: number
          format: double
          nullable: true
          example: 9.1900
        heading:
          type: number
          nullable: true
          example: 180
        speed:
          type: number
          nullable: true
          example: 13.89
        last_update:
          type: string
          format: date-time
          nullable: true
          example: 2026-02-03T14:25:30Z
        status:
          type: string
          enum: [moving, stopped, offline]
          example: moving
        signal_strength:
          type: string
          enum: [strong, medium, weak, none]
          example: strong

    User:
      type: object
      required:
        - id
        - email
        - role
      properties:
        id:
          type: integer
          example: 1
        email:
          type: string
          format: email
          example: admin@bustracker.example.com
        name:
          type: string
          example: Mario Rossi
        role:
          type: string
          enum: [admin, operator]
          example: admin
        active:
          type: boolean
          example: true
        created_at:
          type: string
          format: date-time
        last_login:
          type: string
          format: date-time
          nullable: true

    LoginRequest:
      type: object
      required:
        - email
        - password
      properties:
        email:
          type: string
          format: email
          example: admin@bustracker.example.com
        password:
          type: string
          format: password
          example: SecurePassword123!

    LoginResponse:
      type: object
      required:
        - access_token
        - refresh_token
        - user
      properties:
        access_token:
          type: string
          description: JWT access token (valido 15 min)
          example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
        refresh_token:
          type: string
          description: Refresh token (valido 7 giorni)
          example: rt_7c9e66797425440de944be07fc1f90ae7
        user:
          $ref: '#/components/schemas/User'

paths:
  # ==================== AUTH ====================
  /auth/login:
    post:
      tags: [Auth]
      summary: Login utente
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LoginResponse'
        '401':
          description: Invalid credentials
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /auth/refresh:
    post:
      tags: [Auth]
      summary: Refresh access token
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - refresh_token
              properties:
                refresh_token:
                  type: string
      responses:
        '200':
          description: Token refreshed
          content:
            application/json:
              schema:
                type: object
                properties:
                  access_token:
                    type: string
        '401':
          description: Invalid refresh token

  # ==================== DEVICE ====================
  /device/register:
    post:
      tags: [Device]
      summary: Registrazione nuovo dispositivo
      description: Primo endpoint chiamato dalla PWA per ottenere credenziali
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/DeviceRegistration'
            examples:
              android:
                value:
                  uuid: 550e8400-e29b-41d4-a716-446655440000
                  platform: android
                  app_version: 1.2.3
                  device_model: Samsung Galaxy S21
                  os_version: Android 13
      responses:
        '201':
          description: Dispositivo registrato con successo
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DeviceRegistrationResponse'
              examples:
                success:
                  value:
                    device_id: 42
                    token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkZXZpY2VfaWQiOjQyLCJ0eXBlIjoiZGV2aWNlIiwiaWF0IjoxNjQzODg5NjAwLCJleHAiOjE2NDY0ODE2MDB9.abc123
                    refresh_token: rt_550e8400e29b41d4a716446655440000
                    config:
                      location_interval_ms: 120000
                      movement_threshold_meters: 50
                      retry_backoff_ms: 5000
        '400':
          description: Dati invalidi
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '409':
          description: Dispositivo già registrato (ritorna token esistente)

  /device/{id}:
    get:
      tags: [Device]
      summary: Dettagli dispositivo
      security:
        - UserToken: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: Dettagli dispositivo
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: integer
                  uuid:
                    type: string
                  status:
                    type: string
                    enum: [active, inactive, revoked]
                  last_seen_at:
                    type: string
                    format: date-time
                  created_at:
                    type: string
                    format: date-time

  # ==================== TELEMETRY ====================
  /telemetry/location:
    post:
      tags: [Telemetry]
      summary: Invio posizione da dispositivo
      description: Endpoint chiamato dalla PWA ogni 120s (o alla soglia movimento)
      security:
        - DeviceToken: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LocationPayload'
            examples:
              typical:
                value:
                  latitude: 45.4642
                  longitude: 9.1900
                  accuracy: 12.5
                  altitude: 125.3
                  speed: 13.89
                  heading: 180
                  timestamp: 2026-02-03T14:25:30Z
                  provider: gps
                  battery_level: 78
                  network_type: cellular
                  nonce: 7c9e6679-7425-40de-944b-e07fc1f90ae7
      responses:
        '202':
          description: Posizione accettata
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LocationResponse'
              examples:
                accepted:
                  value:
                    id: 123456
                    status: accepted
                    received_at: 2026-02-03T14:25:31Z
                    next_expected_at: 2026-02-03T14:27:31Z
        '400':
          description: Payload invalido
        '401':
          description: Token invalido o scaduto
        '429':
          description: Rate limit exceeded

  /telemetry/history:
    get:
      tags: [Telemetry]
      summary: Storico posizioni
      security:
        - UserToken: []
      parameters:
        - name: bus_id
          in: query
          required: true
          schema:
            type: integer
        - name: from
          in: query
          schema:
            type: string
            format: date-time
        - name: to
          in: query
          schema:
            type: string
            format: date-time
        - name: limit
          in: query
          schema:
            type: integer
            default: 100
            maximum: 1000
      responses:
        '200':
          description: Storico posizioni
          content:
            application/json:
              schema:
                type: object
                properties:
                  total:
                    type: integer
                  data:
                    type: array
                    items:
                      type: object
                      properties:
                        latitude:
                          type: number
                        longitude:
                          type: number
                        speed:
                          type: number
                        heading:
                          type: number
                        timestamp:
                          type: string
                          format: date-time

  # ==================== FLEET ====================
  /fleet/live:
    get:
      tags: [Fleet]
      summary: Posizioni live di tutti i bus (o filtrate)
      description: Endpoint principale per monitoring frontend
      security:
        - UserToken: []
      parameters:
        - name: line_id
          in: query
          schema:
            type: integer
          description: Filtra per linea specifica
        - name: status
          in: query
          schema:
            type: string
            enum: [moving, stopped, offline, all]
          description: Filtra per stato
        - name: last_update_within
          in: query
          schema:
            type: integer
            default: 300
          description: Secondi dall'ultimo aggiornamento (default 5 min)
      responses:
        '200':
          description: Lista bus con ultima posizione
          content:
            application/json:
              schema:
                type: object
                properties:
                  timestamp:
                    type: string
                    format: date-time
                    description: Server timestamp
                  buses:
                    type: array
                    items:
                      $ref: '#/components/schemas/LiveBus'
              examples:
                two_buses:
                  value:
                    timestamp: 2026-02-03T14:30:00Z
                    buses:
                      - bus_id: 15
                        label: Bus 42
                        plate: AB123CD
                        line_id: 5
                        line_name: L05
                        latitude: 45.4642
                        longitude: 9.1900
                        heading: 180
                        speed: 13.89
                        last_update: 2026-02-03T14:25:30Z
                        status: moving
                        signal_strength: strong
                      - bus_id: 20
                        label: Bus 07
                        plate: XY789ZW
                        line_id: 5
                        line_name: L05
                        latitude: 45.4700
                        longitude: 9.1950
                        heading: 90
                        speed: 0
                        last_update: 2026-02-03T14:28:15Z
                        status: stopped
                        signal_strength: medium

  # ==================== BUSES ====================
  /buses:
    get:
      tags: [Buses]
      summary: Lista tutti gli autobus
      security:
        - UserToken: []
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [active, inactive, maintenance]
        - name: line_id
          in: query
          schema:
            type: integer
      responses:
        '200':
          description: Lista autobus
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Bus'

    post:
      tags: [Buses]
      summary: Crea nuovo autobus
      security:
        - UserToken: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - label
              properties:
                label:
                  type: string
                plate:
                  type: string
                device_id:
                  type: integer
                  nullable: true
                line_id:
                  type: integer
                  nullable: true
                metadata:
                  type: object
            examples:
              new_bus:
                value:
                  label: Bus 42
                  plate: AB123CD
                  device_id: 42
                  line_id: 5
                  metadata:
                    capacity: 80
                    fuel_type: diesel
      responses:
        '201':
          description: Autobus creato
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Bus'

  /buses/{id}:
    get:
      tags: [Buses]
      summary: Dettagli autobus
      security:
        - UserToken: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: Dettagli autobus
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Bus'

    put:
      tags: [Buses]
      summary: Aggiorna autobus
      security:
        - UserToken: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                label:
                  type: string
                plate:
                  type: string
                device_id:
                  type: integer
                  nullable: true
                line_id:
                  type: integer
                  nullable: true
                status:
                  type: string
                  enum: [active, inactive, maintenance]
      responses:
        '200':
          description: Autobus aggiornato
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Bus'

    delete:
      tags: [Buses]
      summary: Elimina autobus
      security:
        - UserToken: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        '204':
          description: Autobus eliminato

  # ==================== LINES ====================
  /lines:
    get:
      tags: [Lines]
      summary: Lista linee
      security:
        - UserToken: []
      parameters:
        - name: active
          in: query
          schema:
            type: boolean
      responses:
        '200':
          description: Lista linee
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Line'

    post:
      tags: [Lines]
      summary: Crea nuova linea
      security:
        - UserToken: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - name
                - code
              properties:
                name:
                  type: string
                code:
                  type: string
                color:
                  type: string
                description:
                  type: string
      responses:
        '201':
          description: Linea creata
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Line'

  # ==================== ROUTES ====================
  /routes:
    get:
      tags: [Routes]
      summary: Lista percorsi
      security:
        - UserToken: []
      parameters:
        - name: line_id
          in: query
          schema:
            type: integer
        - name: active
          in: query
          schema:
            type: boolean
      responses:
        '200':
          description: Lista percorsi
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Route'

    post:
      tags: [Routes]
      summary: Crea nuovo percorso
      security:
        - UserToken: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - line_id
                - name
                - polyline
              properties:
                line_id:
                  type: integer
                name:
                  type: string
                direction:
                  type: string
                  enum: [outbound, inbound]
                polyline:
                  type: string
                stops:
                  type: array
                  items:
                    type: integer
                active_from:
                  type: string
                  format: date
                active_to:
                  type: string
                  format: date
            examples:
              new_route:
                value:
                  line_id: 5
                  name: Percorso A - Andata
                  direction: outbound
                  polyline: _p~iF~ps|U_ulLnnqC_mqNvxq`@
                  stops: [1, 5, 8, 12]
                  active_from: 2026-02-01
                  active_to: 2026-12-31
      responses:
        '201':
          description: Percorso creato
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Route'

  # ==================== STOPS ====================
  /stops:
    get:
      tags: [Stops]
      summary: Lista fermate
      security:
        - UserToken: []
      parameters:
        - name: active
          in: query
          schema:
            type: boolean
      responses:
        '200':
          description: Lista fermate
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Stop'

    post:
      tags: [Stops]
      summary: Crea nuova fermata
      security:
        - UserToken: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - name
                - latitude
                - longitude
              properties:
                name:
                  type: string
                code:
                  type: string
                latitude:
                  type: number
                longitude:
                  type: number
                address:
                  type: string
      responses:
        '201':
          description: Fermata creata
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Stop'

  # ==================== USERS ====================
  /users:
    get:
      tags: [Users]
      summary: Lista utenti
      security:
        - UserToken: []
      responses:
        '200':
          description: Lista utenti
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'

    post:
      tags: [Users]
      summary: Crea nuovo utente
      security:
        - UserToken: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - email
                - password
                - role
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                  format: password
                name:
                  type: string
                role:
                  type: string
                  enum: [admin, operator]
      responses:
        '201':
          description: Utente creato
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
```

## Esempi Payload Dettagliati

### 1. Registrazione Dispositivo (POST /device/register)

**Request**:
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "platform": "android",
  "app_version": "1.2.3",
  "device_model": "Samsung Galaxy S21",
  "os_version": "Android 13",
  "metadata": {
    "screen_size": "6.2 inches",
    "battery_capacity": 4000
  }
}
```

**Response 201**:
```json
{
  "device_id": 42,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkZXZpY2VfaWQiOjQyLCJ0eXBlIjoiZGV2aWNlIiwiaWF0IjoxNjQzODg5NjAwLCJleHAiOjE2NDY0ODE2MDB9.Qr8xV4pN9kLm2sT5wZ7yU3bJ1cA6dE8fG9hI0jK",
  "refresh_token": "rt_550e8400e29b41d4a716446655440000",
  "config": {
    "location_interval_ms": 120000,
    "movement_threshold_meters": 50,
    "retry_backoff_ms": 5000,
    "max_queue_size": 100
  }
}
```

### 2. Invio Posizione (POST /telemetry/location)

**Request Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request Body**:
```json
{
  "latitude": 45.464203,
  "longitude": 9.189982,
  "accuracy": 12.5,
  "altitude": 125.3,
  "speed": 13.89,
  "heading": 180.5,
  "timestamp": "2026-02-03T14:25:30.123Z",
  "provider": "gps",
  "battery_level": 78,
  "network_type": "cellular",
  "nonce": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

**Response 202**:
```json
{
  "id": 123456,
  "status": "accepted",
  "received_at": "2026-02-03T14:25:31.456Z",
  "next_expected_at": "2026-02-03T14:27:31.456Z"
}
```

### 3. Fleet Live (GET /fleet/live?line_id=5)

**Request Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response 200**:
```json
{
  "timestamp": "2026-02-03T14:30:00.000Z",
  "buses": [
    {
      "bus_id": 15,
      "label": "Bus 42",
      "plate": "AB123CD",
      "line_id": 5,
      "line_name": "L05",
      "latitude": 45.464203,
      "longitude": 9.189982,
      "heading": 180.5,
      "speed": 13.89,
      "last_update": "2026-02-03T14:25:30Z",
      "status": "moving",
      "signal_strength": "strong"
    },
    {
      "bus_id": 20,
      "label": "Bus 07",
      "plate": "XY789ZW",
      "line_id": 5,
      "line_name": "L05",
      "latitude": 45.470012,
      "longitude": 9.195034,
      "heading": 90.0,
      "speed": 0,
      "last_update": "2026-02-03T14:28:15Z",
      "status": "stopped",
      "signal_strength": "medium"
    },
    {
      "bus_id": 22,
      "label": "Bus 11",
      "plate": "CD456EF",
      "line_id": 5,
      "line_name": "L05",
      "latitude": null,
      "longitude": null,
      "heading": null,
      "speed": null,
      "last_update": "2026-02-03T13:45:00Z",
      "status": "offline",
      "signal_strength": "none"
    }
  ]
}
```

### 4. Creazione Percorso (POST /routes)

**Request**:
```json
{
  "line_id": 5,
  "name": "Percorso A - Andata Centro-Periferia",
  "direction": "outbound",
  "polyline": "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
  "stops": [1, 5, 8, 12, 15, 18, 22],
  "active_from": "2026-02-01",
  "active_to": "2026-12-31",
  "metadata": {
    "estimated_duration_minutes": 45,
    "distance_km": 18.5,
    "traffic_zones": ["A", "B", "C"]
  }
}
```

**Response 201**:
```json
{
  "id": 10,
  "line_id": 5,
  "name": "Percorso A - Andata Centro-Periferia",
  "direction": "outbound",
  "polyline": "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
  "stops": [1, 5, 8, 12, 15, 18, 22],
  "active_from": "2026-02-01",
  "active_to": "2026-12-31",
  "metadata": {
    "estimated_duration_minutes": 45,
    "distance_km": 18.5,
    "traffic_zones": ["A", "B", "C"]
  },
  "created_at": "2026-02-03T14:30:00Z",
  "updated_at": "2026-02-03T14:30:00Z"
}
```

### 5. Storico Posizioni (GET /telemetry/history)

**Request**:
```
GET /telemetry/history?bus_id=15&from=2026-02-03T00:00:00Z&to=2026-02-03T23:59:59Z&limit=500
```

**Response 200**:
```json
{
  "total": 342,
  "bus_id": 15,
  "from": "2026-02-03T00:00:00Z",
  "to": "2026-02-03T23:59:59Z",
  "data": [
    {
      "latitude": 45.464203,
      "longitude": 9.189982,
      "speed": 13.89,
      "heading": 180.5,
      "accuracy": 12.5,
      "timestamp": "2026-02-03T14:25:30Z"
    },
    {
      "latitude": 45.463891,
      "longitude": 9.190234,
      "speed": 15.2,
      "heading": 182.0,
      "accuracy": 10.2,
      "timestamp": "2026-02-03T14:23:30Z"
    }
  ]
}
```

## WebSocket Events

### Connection
```javascript
// Client connection
const socket = io('wss://api.bustracker.example.com', {
  auth: {
    token: 'JWT_TOKEN_HERE'
  }
});

// Server acknowledgement
socket.on('connect', () => {
  console.log('Connected:', socket.id);
});
```

### Subscribe to Line
```javascript
// Client subscribes
socket.emit('subscribe_line', { line_id: 5 });

// Server confirms
socket.on('subscribed', (data) => {
  // { line_id: 5, buses: [...] }
});
```

### Location Update Event
```javascript
// Server broadcasts to line room
socket.on('location_update', (data) => {
  /*
  {
    bus_id: 15,
    latitude: 45.464203,
    longitude: 9.189982,
    heading: 180.5,
    speed: 13.89,
    timestamp: "2026-02-03T14:25:30Z",
    status: "moving"
  }
  */
});
```

### Bus Status Change
```javascript
socket.on('bus_status', (data) => {
  /*
  {
    bus_id: 20,
    status: "offline",
    last_seen: "2026-02-03T14:20:00Z"
  }
  */
});
```

## Rate Limiting Headers

Tutte le risposte includono header rate limiting:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1643889660
Retry-After: 60
```

## Error Codes

| HTTP Code | Error Code | Descrizione |
|-----------|------------|-------------|
| 400 | VALIDATION_ERROR | Payload invalido |
| 401 | UNAUTHORIZED | Token mancante o invalido |
| 403 | FORBIDDEN | Permessi insufficienti |
| 404 | NOT_FOUND | Risorsa non trovata |
| 409 | CONFLICT | Risorsa già esistente |
| 422 | UNPROCESSABLE_ENTITY | Logica business violata |
| 429 | RATE_LIMIT_EXCEEDED | Troppi request |
| 500 | INTERNAL_ERROR | Errore server |
| 503 | SERVICE_UNAVAILABLE | Servizio temporaneamente non disponibile |

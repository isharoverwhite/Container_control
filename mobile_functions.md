# Container Control Mobile Application - Technical Specification

## Table of Contents
1. [Application Overview](#application-overview)
2. [Architecture](#architecture)
3. [Core Services](#core-services)
4. [Screen Components](#screen-components)
5. [Data Models](#data-models)
6. [Real-time Communication](#real-time-communication)
7. [Authentication & Security](#authentication--security)

---

## Application Overview

**Platform**: Flutter (Cross-platform: Android, iOS, macOS, Linux, Windows)
**Purpose**: Remote Docker container management client
**Communication**: HTTPS REST API + Socket.IO for real-time updates
**State Management**: StatefulWidget with local state

### Key Features
- Multi-server management with server switching
- Real-time container monitoring via Socket.IO
- Docker Hub image search and pull
- Container lifecycle management (start, stop, restart, delete)
- Interactive terminal access to containers
- Volume and stack management
- Device-based authentication with approval workflow

---

## Architecture

### Directory Structure
```
client/lib/
├── main.dart                 # Application entry point
├── models/                   # Data models
├── screens/                  # UI screens (14 screens)
├── services/                 # Business logic services (3 services)
└── widgets/                  # Reusable UI components (6 widgets)
```

### Application Flow
```
main.dart
  ↓
WelcomeScreen (first launch)
  ↓
OnboardingScreen (server setup)
  ↓
HomeScreen (main navigation hub)
  ├── ContainersScreen
  ├── ImagesScreen
  ├── VolumesScreen
  ├── StacksScreen
  └── ServerStatusScreen
```

---

## Core Services

### 1. ApiService (Singleton)
**File**: `lib/services/api_service.dart`
**Purpose**: Centralized HTTP API client and Socket.IO connection manager

#### Key Properties
- `socket`: IO.Socket - Singleton Socket.IO connection
- `_baseUrl`: String - Current server base URL
- `_apiKey`: String - Current server API key

#### Core Methods

##### Connection Management
```dart
_ensureConnected()
```
- **Purpose**: Ensures Socket.IO connection is established
- **Logic**: 
  - Checks if socket is connected
  - If not connected, calls `socket.connect()`
  - Waits for connection with timeout

```dart
_initSocket()
```
- **Purpose**: Initializes Socket.IO connection with configuration
- **Logic**:
  - Creates Socket.IO instance with server URL
  - Sets authentication headers (x-secret-key, x-device-id, x-device-name)
  - Configures reconnection options (unlimited attempts, delays)
  - Sets up event listeners:
    - `onConnect`: Logs successful connection
    - `onConnectError`: Logs connection errors
    - `onDisconnect`: Logs disconnection
    - `onError`: Logs general errors
    - `onReconnect`: Logs reconnection attempts
  - Suppresses noisy SocketException errors

```dart
reinitSocket()
```
- **Purpose**: Reinitializes socket when server changes
- **Logic**:
  - Disposes current socket
  - Calls `_initSocket()` to create new connection

##### Container Operations
```dart
Future<List<dynamic>> getContainers()
```
- **Purpose**: Fetches all containers from server
- **HTTP**: GET `/api/containers`
- **Returns**: List of container objects
- **Error Handling**: Throws exception with parsed error message

```dart
Future<void> startContainer(String id)
```
- **Purpose**: Starts a stopped container
- **HTTP**: POST `/api/containers/{id}/start`
- **Parameters**: `id` - Container ID
- **Error Handling**: Throws exception on failure

```dart
Future<void> stopContainer(String id)
```
- **Purpose**: Stops a running container
- **HTTP**: POST `/api/containers/{id}/stop`
- **Parameters**: `id` - Container ID

```dart
Future<void> restartContainer(String id)
```
- **Purpose**: Restarts a container
- **HTTP**: POST `/api/containers/{id}/restart`
- **Parameters**: `id` - Container ID

```dart
Future<void> duplicateContainer(String id)
```
- **Purpose**: Creates a copy of existing container
- **HTTP**: POST `/api/containers/{id}/duplicate`
- **Parameters**: `id` - Source container ID

```dart
Future<void> deleteContainer(String id)
```
- **Purpose**: Deletes a container
- **HTTP**: DELETE `/api/containers/{id}?force=true`
- **Parameters**: `id` - Container ID
- **Query**: `force=true` - Force deletion even if running

```dart
Future<Map<String, dynamic>> inspectContainer(String id)
```
- **Purpose**: Gets detailed container information
- **HTTP**: GET `/api/containers/{id}`
- **Returns**: Container inspection data (config, state, networks, etc.)

```dart
Future<void> updateContainer(String id, {Map<String, dynamic>? restartPolicy})
```
- **Purpose**: Updates container configuration
- **HTTP**: POST `/api/containers/{id}/update`
- **Parameters**: 
  - `id` - Container ID
  - `restartPolicy` - New restart policy configuration
- **Body**: JSON with restart policy

##### Image Operations
```dart
Future<List<dynamic>> getImages()
```
- **Purpose**: Fetches all local Docker images
- **HTTP**: GET `/api/images`
- **Returns**: List of image objects

```dart
Future<void> pullImage(String image)
```
- **Purpose**: Pulls an image from Docker Hub (blocking)
- **HTTP**: POST `/api/images/pull`
- **Body**: `{"image": "imageName:tag"}`
- **Note**: Blocks until pull completes

```dart
Future<void> pullImageBackground(String image)
```
- **Purpose**: Initiates background image pull with real-time progress
- **HTTP**: POST `/api/images/pull`
- **Body**: `{"image": "imageName:tag"}`
- **Real-time Events**: Emits `docker_pull_progress`, `docker_pull_complete`, `docker_pull_error` via Socket.IO

```dart
Future<List<dynamic>> getPullingImages()
```
- **Purpose**: Gets list of currently pulling images
- **HTTP**: GET `/api/images/pulling`
- **Returns**: Array of pulling image names

```dart
Future<List<dynamic>> searchImages(String term)
```
- **Purpose**: Searches Docker Hub for images
- **HTTP**: GET `https://hub.docker.com/v2/search/repositories?query={term}`
- **Returns**: Search results with image metadata
- **Note**: Direct Docker Hub API call, not through gateway

```dart
Future<void> deleteImage(String id)
```
- **Purpose**: Deletes a local image
- **HTTP**: DELETE `/api/images/{id}?force=true`
- **Parameters**: `id` - Image ID
- **Query**: `force=true` - Force deletion

##### Volume Operations
```dart
Future<Map<String, dynamic>> getVolumes()
```
- **Purpose**: Fetches all Docker volumes
- **HTTP**: GET `/api/volumes`
- **Returns**: Object with `Volumes` array and metadata

```dart
Future<void> createVolume({required String name, String? driver, Map<String, String>? driverOpts, Map<String, String>? labels})
```
- **Purpose**: Creates a new Docker volume
- **HTTP**: POST `/api/volumes`
- **Parameters**:
  - `name` - Volume name (required)
  - `driver` - Volume driver (optional, default: local)
  - `driverOpts` - Driver-specific options
  - `labels` - Volume labels
- **Body**: JSON with volume configuration

```dart
Future<void> deleteVolume(String name)
```
- **Purpose**: Deletes a volume
- **HTTP**: DELETE `/api/volumes/{name}?force=true`
- **Parameters**: `name` - Volume name

##### Stack Operations
```dart
Future<List<dynamic>> getStacks()
```
- **Purpose**: Fetches all Docker Compose stacks
- **HTTP**: GET `/api/stacks`
- **Returns**: List of stack objects

```dart
Future<void> createStack(String name, String content)
```
- **Purpose**: Creates a new stack from docker-compose.yml
- **HTTP**: POST `/api/stacks`
- **Body**: `{"name": "stackName", "content": "yaml content"}`

```dart
Future<void> upStack(String name)
```
- **Purpose**: Starts a stack (docker-compose up)
- **HTTP**: POST `/api/stacks/{name}/up`

```dart
Future<void> downStack(String name)
```
- **Purpose**: Stops and removes a stack (docker-compose down)
- **HTTP**: POST `/api/stacks/{name}/down`

```dart
Future<void> controlStack(String name, String action)
```
- **Purpose**: Performs action on stack (start, stop, restart)
- **HTTP**: POST `/api/stacks/{name}/{action}`
- **Parameters**:
  - `name` - Stack name
  - `action` - One of: start, stop, restart

##### Network Operations
```dart
Future<List<dynamic>> getNetworks()
```
- **Purpose**: Fetches all Docker networks
- **HTTP**: GET `/api/networks`
- **Returns**: List of network objects

```dart
Future<void> connectNetwork(String containerId, String networkId)
```
- **Purpose**: Connects container to network
- **HTTP**: POST `/api/networks/{networkId}/connect`
- **Body**: `{"Container": "containerId"}`

```dart
Future<void> disconnectNetwork(String containerId, String networkId)
```
- **Purpose**: Disconnects container from network
- **HTTP**: POST `/api/networks/{networkId}/disconnect`
- **Body**: `{"Container": "containerId"}`

##### Container Creation
```dart
Future<Map<String, dynamic>> createContainer(Map<String, dynamic> config)
```
- **Purpose**: Creates a new container
- **HTTP**: POST `/api/containers`
- **Body**: Full container configuration JSON
- **Returns**: Created container data with ID

```dart
Future<void> recreateContainer(String id)
```
- **Purpose**: Recreates a container with same configuration
- **HTTP**: POST `/api/containers/{id}/recreate`

##### System Operations
```dart
Future<Map<String, dynamic>> getSystemInfo()
```
- **Purpose**: Gets Docker system information
- **HTTP**: GET `/api/system/info`
- **Returns**: System info (version, OS, architecture, etc.)

##### Authentication
```dart
Future<Map<String, dynamic>> login(String username, String password, {String? server})
```
- **Purpose**: Traditional username/password login
- **HTTP**: POST `/api/auth/login`
- **Body**: `{"username": "...", "password": "..."}`
- **Returns**: `{"secretKey": "..."}`
- **Note**: Currently not used, replaced by device-based auth

```dart
Future<Map<String, dynamic>> initDeviceLogin()
```
- **Purpose**: Initiates device-based login flow
- **HTTP**: POST `/api/auth/device/init`
- **Body**: `{"deviceId": "uuid", "deviceName": "Device Name"}`
- **Returns**: `{"status": "pending"}` or `{"status": "approved", "secretKey": "..."}`
- **Logic**:
  - Sends device ID and name to server
  - Server creates pending device entry
  - Returns pending status for admin approval

```dart
Future<Map<String, dynamic>> pollDeviceLogin()
```
- **Purpose**: Polls for device approval status
- **HTTP**: POST `/api/auth/device/poll`
- **Body**: `{"deviceId": "uuid"}`
- **Returns**: `{"status": "pending"}` or `{"status": "approved", "secretKey": "..."}`
- **Logic**:
  - Called repeatedly until approved
  - Returns secret key when approved

```dart
Future<void> logout()
```
- **Purpose**: Logs out current session
- **HTTP**: POST `/api/auth/logout`

##### Docker Hub Integration
```dart
Future<Map<String, dynamic>> getDockerHubRepository(String name)
```
- **Purpose**: Gets Docker Hub repository details
- **HTTP**: GET `https://hub.docker.com/v2/repositories/{name}`
- **Returns**: Repository metadata (description, stars, pulls, etc.)

```dart
Future<List<dynamic>> getDockerHubTags(String name)
```
- **Purpose**: Gets available tags for Docker Hub image
- **HTTP**: GET `https://hub.docker.com/v2/repositories/{name}/tags`
- **Returns**: List of available tags

---

### 2. ServerManager (Singleton)
**File**: `lib/services/server_manager.dart`
**Purpose**: Manages multiple server configurations and active server selection

#### Key Properties
- `_servers`: List<ServerConfig> - All saved servers
- `_activeServer`: ServerConfig? - Currently active server
- `_deviceId`: String - Unique device identifier (UUID)
- `_deviceName`: String - Human-readable device name
- `onServerChanged`: Function()? - Callback when server changes

#### Methods

```dart
Future<void> init()
```
- **Purpose**: Initializes server manager on app startup
- **Logic**:
  1. Loads saved servers from SharedPreferences
  2. Generates or loads device ID (UUID v4)
  3. Fetches device name from platform:
     - Android: `androidInfo.model`
     - iOS: `iosInfo.utsname.machine`
     - macOS: `macInfo.computerName`
     - Linux: `linuxInfo.name`
     - Windows: `winInfo.computerName`
  4. Loads active server from preferences
  5. Sets first server as active if none selected

```dart
Future<void> addServer(ServerConfig server)
```
- **Purpose**: Adds a new server configuration
- **Parameters**: `server` - ServerConfig object
- **Logic**:
  1. Adds server to `_servers` list
  2. Saves to SharedPreferences
  3. Sets as active if no active server exists

```dart
Future<void> removeServer(ServerConfig server)
```
- **Purpose**: Removes a server configuration
- **Parameters**: `server` - ServerConfig to remove
- **Logic**:
  1. Removes server from `_servers` list
  2. Saves updated list to SharedPreferences
  3. If removed server was active:
     - Sets first remaining server as active
     - Or sets active to null if no servers left
  4. Calls `onServerChanged` callback

```dart
Future<void> setActiveServer(ServerConfig server)
```
- **Purpose**: Switches to a different server
- **Parameters**: `server` - ServerConfig to activate
- **Logic**:
  1. Sets `_activeServer` to new server
  2. Saves active server index to SharedPreferences
  3. Calls `onServerChanged` callback
  4. Triggers socket reconnection in ApiService

```dart
Future<void> removeActiveServer()
```
- **Purpose**: Removes currently active server (used on forced logout)
- **Logic**: Calls `removeServer(_activeServer)`

---

### 3. NotificationService (Singleton)
**File**: `lib/services/notification_service.dart`
**Purpose**: Manages local push notifications for background events

#### Methods

```dart
Future<void> init()
```
- **Purpose**: Initializes notification service
- **Logic**:
  - Requests notification permissions
  - Configures notification channels
  - Sets up notification handlers

---

## Screen Components

### 1. WelcomeScreen
**File**: `lib/screens/welcome_screen.dart`
**Purpose**: Initial landing screen for first-time users

**UI Elements**:
- App logo/branding
- "Get Started" button → navigates to OnboardingScreen

**Logic**:
- Checks if servers exist in ServerManager
- If servers exist, navigates directly to HomeScreen
- Otherwise shows welcome UI

---

### 2. OnboardingScreen
**File**: `lib/screens/onboarding_screen.dart`
**Purpose**: Server setup and device authentication

**UI Elements**:
- Server IP/Port input field
- Server name input field
- API key input field (optional for device auth)
- "Connect" button
- Device approval status indicator

**Logic Flow**:
1. User enters server details (IP:Port, name)
2. User clicks "Connect"
3. App calls `ApiService().initDeviceLogin()`
4. Server returns pending status
5. UI shows "Waiting for admin approval..." message
6. App polls `ApiService().pollDeviceLogin()` every 2 seconds
7. When approved:
   - Saves server config with secret key
   - Navigates to HomeScreen

**State Management**:
- `_isConnecting`: bool - Connection in progress
- `_isPending`: bool - Waiting for approval
- `_errorMessage`: String? - Error display

---

### 3. HomeScreen
**File**: `lib/screens/home_screen.dart`
**Purpose**: Main navigation hub with bottom navigation bar

**UI Elements**:
- AppBar with server selector dropdown
- Bottom navigation bar with 5 tabs:
  1. Containers (default)
  2. Images
  3. Volumes
  4. Stacks
  5. Server Status
- Floating action button (context-dependent)

**Navigation Logic**:
```dart
_onItemTapped(int index)
```
- Updates `_selectedIndex`
- Displays corresponding screen:
  - 0: ContainersScreen
  - 1: ImagesScreen
  - 2: VolumesScreen
  - 3: StacksScreen
  - 4: ServerStatusScreen

**Server Management**:
```dart
_showServerListDialog()
```
- **Purpose**: Displays list of saved servers
- **UI**: Dialog with server list
- **Actions**:
  - Tap server → switch active server
  - Long press → delete server
  - "Add Server" button → opens add dialog

```dart
_showAddServerDialog()
```
- **Purpose**: Add new server configuration
- **UI**: Dialog with input fields (name, IP:Port, API key)
- **Logic**:
  1. Validates inputs
  2. Creates ServerConfig object
  3. Calls `ServerManager().addServer()`
  4. Closes dialog

**State Management**:
- `_selectedIndex`: int - Active tab index
- Listens to `ServerManager().onServerChanged`
- Calls `ApiService().reinitSocket()` on server change

---

### 4. ContainersScreen
**File**: `lib/screens/containers_screen.dart`
**Purpose**: Lists and manages Docker containers

**UI Elements**:
- Pull-to-refresh
- Search/filter bar
- Container cards with:
  - Container name
  - Status indicator (running/stopped/paused)
  - Image name
  - Uptime (for running containers)
  - Quick action buttons (start/stop/restart)
  - More options menu
- Floating action button → Create Container

**Data Loading**:
```dart
_refreshContainers({bool silent = false})
```
- **Purpose**: Fetches containers from server
- **Logic**:
  1. Calls `ApiService().getContainers()`
  2. Parses response into ContainerModel objects
  3. Updates `_containers` list
  4. Sets `_loading = false`
- **Parameters**: `silent` - If true, doesn't show loading indicator
- **Auto-refresh**: Calls every 3 seconds via Timer

**Container Actions**:
```dart
_handleAction(String id, String action, String containerName)
```
- **Purpose**: Executes container action
- **Parameters**:
  - `id` - Container ID
  - `action` - Action to perform
  - `containerName` - Container name for confirmation dialogs
- **Actions**:
  - `start`: Calls `ApiService().startContainer(id)`
  - `stop`: Calls `ApiService().stopContainer(id)`
  - `restart`: Calls `ApiService().restartContainer(id)`
  - `duplicate`: Calls `ApiService().duplicateContainer(id)`
  - `delete`: Shows confirmation, calls `ApiService().deleteContainer(id)`
  - `logs`: Navigates to LogsScreen
  - `details`: Navigates to ContainerDetailScreen
- **UI Feedback**: Shows SnackBar on success/error

```dart
_showContainerActions(ContainerModel container)
```
- **Purpose**: Shows bottom sheet with all available actions
- **UI**: Bottom sheet with action buttons
- **Actions**: Start, Stop, Restart, Logs, Details, Duplicate, Delete

**State Management**:
- `_containers`: List<ContainerModel> - Container list
- `_loading`: bool - Loading state
- `_refreshTimer`: Timer? - Auto-refresh timer

**Lifecycle**:
- `initState()`: Starts auto-refresh timer
- `dispose()`: Cancels timer

---

### 5. ContainerDetailScreen
**File**: `lib/screens/container_detail_screen.dart`
**Purpose**: Detailed container information and management

**UI Elements**:
- Container header with name and status
- Action buttons (Start/Stop/Restart/Delete)
- Tabbed interface:
  - **Overview**: Basic info, uptime, restart policy
  - **Logs**: Real-time container logs
  - **Terminal**: Interactive shell access
  - **Networks**: Network connections
  - **Volumes**: Volume mounts
  - **Environment**: Environment variables

**Data Loading**:
```dart
_refreshDetails({bool silent = false})
```
- **Purpose**: Fetches detailed container info
- **Logic**:
  1. Calls `ApiService().inspectContainer(widget.containerId)`
  2. Parses response
  3. Updates UI state
  4. Starts uptime timer if running

**Real-time Logs**:
```dart
_connectSocket()
```
- **Purpose**: Establishes Socket.IO connection for real-time logs
- **Logic**:
  1. Gets socket from ApiService
  2. Registers `log_chunk` event listener
  3. Emits `subscribe_logs` with container ID
  4. Appends log chunks to `_logs` list
  5. Auto-scrolls to bottom
- **Cleanup**: Emits `unsubscribe_logs` on dispose

**Interactive Terminal**:
- Uses `ContainerTerminal` widget
- Establishes WebSocket connection to `/api/containers/{id}/exec`
- Sends user input to container shell
- Displays output in xterm.js-style terminal

**Network Management**:
```dart
_disconnectNetwork(String name, String networkId)
```
- **Purpose**: Disconnects container from network
- **Logic**: Calls `ApiService().disconnectNetwork(containerId, networkId)`

```dart
_showConnectNetworkDialog()
```
- **Purpose**: Shows dialog to connect to new network
- **UI**: Dialog with network dropdown
- **Logic**:
  1. Fetches available networks
  2. Shows selection dialog
  3. Calls `ApiService().connectNetwork(containerId, networkId)`

**Restart Policy Update**:
```dart
_updateRestartPolicy(String? newValue)
```
- **Purpose**: Updates container restart policy
- **Parameters**: `newValue` - New policy (no, always, on-failure, unless-stopped)
- **Logic**: Calls `ApiService().updateContainer(id, restartPolicy: {...})`

**State Management**:
- `_containerDetails`: Map<String, dynamic>? - Container inspection data
- `_logs`: List<String> - Log lines
- `_selectedTab`: int - Active tab index
- `_uptimeTimer`: Timer? - Uptime update timer

---

### 6. ImagesScreen
**File**: `lib/screens/images_screen.dart`
**Purpose**: Lists and manages Docker images

**UI Elements**:
- Pull-to-refresh
- Image cards with:
  - Image name and tag
  - Size
  - Created date
  - Delete button
- Floating action button → Docker Hub Search
- Login to Docker Hub dialog (for private images)

**Data Loading**:
```dart
_refreshImages()
```
- **Purpose**: Fetches images from server
- **Logic**: Calls `ApiService().getImages()`

**Socket.IO Integration**:
```dart
_setupSocketListeners()
```
- **Purpose**: Listens for image pull events
- **Events**:
  - `docker_pull_complete`: Refreshes image list
  - `docker_pull_error`: Shows error notification

**Image Deletion**:
```dart
_deleteImage(String id)
```
- **Purpose**: Deletes an image
- **Logic**:
  1. Shows confirmation dialog
  2. Calls `ApiService().deleteImage(id)`
  3. Refreshes image list
  4. Shows success/error message

**Docker Hub Search**:
```dart
_openDockerHubSearch()
```
- **Purpose**: Opens Docker Hub search screen
- **Navigation**: Pushes DockerHubSearchScreen

**Docker Hub Login**:
```dart
_showLoginDialog()
```
- **Purpose**: Shows Docker Hub login dialog
- **UI**: Dialog with username/password fields
- **Note**: Currently not implemented on server side

---

### 7. DockerHubSearchScreen
**File**: `lib/screens/docker_hub_search_screen.dart`
**Purpose**: Search and pull images from Docker Hub

**UI Elements**:
- Search bar
- Search results list with:
  - Image name
  - Description
  - Star count
  - Pull count
  - Official badge
- Pull button for each result

**Search Logic**:
- Debounced search (500ms delay)
- Calls `ApiService().searchImages(query)`
- Displays results in scrollable list

**Image Pull**:
- Taps image → navigates to DockerHubImageDetailScreen
- Shows tags and pull options

---

### 8. DockerHubImageDetailScreen
**File**: `lib/screens/docker_hub_image_detail_screen.dart`
**Purpose**: Shows image details and handles pull with progress

**UI Elements**:
- Image name and description
- Available tags list
- Pull button
- Pull progress indicator
- Pull status messages

**Data Loading**:
- Calls `ApiService().getDockerHubRepository(imageName)`
- Calls `ApiService().getDockerHubTags(imageName)`

**Image Pull with Progress**:
```dart
_pullImage(String tag)
```
- **Purpose**: Pulls image with real-time progress
- **Logic**:
  1. Calls `ApiService().pullImageBackground("${imageName}:${tag}")`
  2. Registers Socket.IO listeners:
     - `docker_pull_start`: Shows "Starting..." status
     - `docker_pull_progress`: Updates progress bar
     - `docker_pull_complete`: Shows success, navigates back
     - `docker_pull_error`: Shows error message
  3. Sets 10-minute timeout for stuck pulls
- **Cleanup**: Removes listeners on dispose

**State Management**:
- `_isPulling`: bool - Pull in progress
- `_pullStatus`: String - Status message
- `_pullProgress`: double - Progress percentage (0-1)
- `_pullTimeoutTimer`: Timer? - Timeout timer
- `_selectedTag`: String - Selected tag to pull

---

### 9. ImageDetailScreen
**File**: `lib/screens/image_detail_screen.dart`
**Purpose**: Shows local image details

**UI Elements**:
- Image name and tags
- Size
- Created date
- Layers information
- Delete button
- "Create Container" button

**Actions**:
- Delete: Calls `ApiService().deleteImage(id)`
- Create Container: Navigates to CreateContainerScreen with pre-filled image

---

### 10. VolumesScreen
**File**: `lib/screens/volumes_screen.dart`
**Purpose**: Lists and manages Docker volumes

**UI Elements**:
- Pull-to-refresh
- Volume cards with:
  - Volume name
  - Driver
  - Mount point
  - Delete button
- Floating action button → Create Volume

**Data Loading**:
```dart
_refreshVolumes()
```
- **Purpose**: Fetches volumes from server
- **Logic**: Calls `ApiService().getVolumes()`

**Volume Creation**:
```dart
_showCreateVolumeDialog()
```
- **Purpose**: Shows dialog to create new volume
- **UI**: Dialog with:
  - Volume name input
  - Driver selection (local, nfs, etc.)
  - Driver options (key-value pairs)
  - Labels (key-value pairs)
- **Logic**: Calls `ApiService().createVolume(...)`

**Volume Deletion**:
```dart
_deleteVolume(String name)
```
- **Purpose**: Deletes a volume
- **Logic**:
  1. Shows confirmation dialog
  2. Calls `ApiService().deleteVolume(name)`
  3. Refreshes volume list

---

### 11. StacksScreen
**File**: `lib/screens/stacks_screen.dart`
**Purpose**: Manages Docker Compose stacks

**UI Elements**:
- Stack cards with:
  - Stack name
  - Status (up/down)
  - Container count
  - Control buttons (up/down/restart)
- Floating action button → Create Stack

**Stack Control**:
- Up: Calls `ApiService().upStack(name)`
- Down: Calls `ApiService().downStack(name)`
- Restart: Calls `ApiService().controlStack(name, 'restart')`

**Stack Creation**:
- Shows dialog with:
  - Stack name input
  - docker-compose.yml content editor
- Calls `ApiService().createStack(name, content)`

---

### 12. CreateContainerScreen
**File**: `lib/screens/create_container_screen.dart`
**Purpose**: Creates new containers with configuration

**UI Elements**:
- Container name input
- Image selection
- Port mappings (host:container)
- Volume mounts
- Environment variables (key-value pairs)
- Network selection
- Restart policy dropdown
- "Create" button

**Configuration Building**:
- Builds JSON configuration object
- Calls `ApiService().createContainer(config)`
- Navigates back to ContainersScreen on success

---

### 13. ServerStatusScreen
**File**: `lib/screens/server_status_screen.dart`
**Purpose**: Shows Docker system information

**UI Elements**:
- Docker version
- OS information
- Architecture
- Total containers
- Running containers
- Total images
- Server IP/Port

**Data Loading**:
- Calls `ApiService().getSystemInfo()`
- Displays system metrics

---

### 14. LogsScreen
**File**: `lib/screens/logs_screen.dart`
**Purpose**: Displays real-time container logs

**UI Elements**:
- Scrollable log viewer
- Auto-scroll to bottom
- Loading indicator

**Real-time Logs**:
```dart
_connectSocket()
```
- **Purpose**: Subscribes to container logs via Socket.IO
- **Logic**:
  1. Gets socket from ApiService
  2. Registers `log_chunk` listener immediately
  3. Emits `subscribe_logs` with container ID
  4. On reconnect: re-subscribes automatically
  5. Appends log chunks to `_logs` list
- **Cleanup**: Emits `unsubscribe_logs` and removes listener on dispose

**State Management**:
- `_logs`: List<String> - Log lines
- `_scrollController`: ScrollController - Auto-scroll controller

---

## Data Models

### ContainerModel
**File**: `lib/models/container_model.dart`

**Properties**:
- `id`: String - Container ID
- `name`: String - Container name
- `image`: String - Image name
- `state`: String - Container state (running, stopped, paused, etc.)
- `status`: String - Human-readable status
- `created`: DateTime - Creation timestamp

**Methods**:
- `fromJson(Map<String, dynamic> json)` - Parses API response
- `toJson()` - Converts to JSON

---

### ServerConfig
**File**: `lib/models/server_config.dart`

**Properties**:
- `name`: String - Server display name
- `ip`: String - Server IP:Port
- `apiKey`: String - API authentication key

**Methods**:
- `fromJson(Map<String, dynamic> json)` - Deserializes from storage
- `toJson()` - Serializes for storage

---

## Real-time Communication

### Socket.IO Events

#### Client → Server Events
- `subscribe_logs`: Subscribe to container logs
  - Payload: `containerId`
- `unsubscribe_logs`: Unsubscribe from container logs
  - Payload: `containerId`

#### Server → Client Events
- `log_chunk`: Container log data
  - Payload: `{chunk: "log line"}`
- `docker_pull_start`: Image pull started
  - Payload: `{image: "imageName:tag"}`
- `docker_pull_progress`: Image pull progress update
  - Payload: `{image: "imageName:tag", progress: {layers: [...]}}`
- `docker_pull_complete`: Image pull completed
  - Payload: `{image: "imageName:tag"}`
- `docker_pull_error`: Image pull failed
  - Payload: `{image: "imageName:tag", error: "message"}`
- `action_status`: General action status notification
  - Payload: `{type: "success"|"error", message: "..."}`
- `force_logout`: Admin forced device logout
  - Payload: `{reason: "Device deleted"}`

---

## Authentication & Security

### Device-Based Authentication Flow

1. **Device Registration**:
   - App generates UUID on first launch
   - Stored in SharedPreferences
   - Sent with every authentication request

2. **Login Flow**:
   ```
   User enters server IP → App calls initDeviceLogin()
   ↓
   Server creates pending device entry
   ↓
   App polls pollDeviceLogin() every 2s
   ↓
   Admin approves device in WebUI
   ↓
   Server returns secretKey
   ↓
   App stores secretKey and navigates to HomeScreen
   ```

3. **API Authentication**:
   - Every HTTP request includes header: `x-secret-key: {secretKey}`
   - Every Socket.IO connection includes auth: `{token: secretKey}`

4. **Device Identification**:
   - Headers sent with every request:
     - `x-device-id`: UUID
     - `x-device-name`: Platform-specific device name
     - `x-secret-key`: Authentication token

5. **Forced Logout**:
   - Server emits `force_logout` event
   - App removes active server
   - Navigates to WelcomeScreen
   - Shows "Device disconnected by Admin" message

### SSL/TLS Handling
- App uses self-signed certificates for development
- `DevHttpOverrides` class bypasses certificate validation
- Production should use valid certificates

---

## Error Handling

### API Error Parsing
```dart
_parseErrorMessage(dynamic error)
```
- **Purpose**: Extracts user-friendly error messages from API responses
- **Logic**:
  1. Checks if error is HttpException
  2. Parses JSON response body
  3. Extracts `error` or `message` field
  4. Returns formatted error string

### User Feedback
- **SnackBar**: Used for action confirmations and errors
- **Dialogs**: Used for confirmations (delete, etc.)
- **Loading Indicators**: Shown during async operations

---

## State Management Patterns

### Local State (StatefulWidget)
- Each screen manages its own state
- Uses `setState()` for UI updates
- Timer-based auto-refresh for data

### Singleton Services
- `ApiService`: Single HTTP client and Socket.IO connection
- `ServerManager`: Single source of truth for server configs
- `NotificationService`: Single notification manager

### Callbacks
- `ServerManager.onServerChanged`: Notifies screens of server changes
- Socket.IO event listeners: Real-time data updates

---

## Performance Optimizations

### Auto-refresh Strategy
- Silent refresh: `_refresh(silent: true)` - No loading indicator
- Prevents UI flicker on background updates
- 3-second intervals for containers, images, volumes

### Socket.IO Connection Management
- Single persistent connection (singleton)
- Automatic reconnection with exponential backoff
- Listener cleanup on screen dispose

### Memory Management
- Timers cancelled in `dispose()`
- Socket listeners removed in `dispose()`
- ScrollControllers disposed properly

---

## Platform-Specific Features

### Android
- Material Design components
- System back button handling
- Notification channels

### iOS
- Cupertino-style dialogs (optional)
- iOS-specific device info

### Desktop (macOS, Linux, Windows)
- Window resizing support
- Desktop-specific device names
- Keyboard shortcuts (future enhancement)

---

## Dependencies

### Core Dependencies
- `flutter`: UI framework
- `http`: HTTP client
- `socket_io_client`: Socket.IO client
- `shared_preferences`: Local storage
- `uuid`: UUID generation
- `device_info_plus`: Device information

### UI Dependencies
- `xterm`: Terminal emulator widget
- Custom widgets (animated navbar, spinners, etc.)

---

## Future Enhancements

### Planned Features
1. **Offline Mode**: Cache data for offline viewing
2. **Push Notifications**: Background notifications for container events
3. **Biometric Auth**: Fingerprint/Face ID for app access
4. **Multi-language Support**: Internationalization
5. **Dark/Light Theme Toggle**: User preference
6. **Container Stats**: Real-time CPU/Memory graphs
7. **Backup/Restore**: Export/import server configurations

---

## Debugging & Logging

### Debug Prints
- Socket connection events logged to console
- API errors logged with stack traces
- Container action results logged

### Error Suppression
- `SocketException` errors suppressed (noisy)
- Only critical errors shown to user

---

## Testing Considerations

### Unit Tests
- ApiService methods
- ServerManager logic
- Data model parsing

### Integration Tests
- Full authentication flow
- Container lifecycle operations
- Image pull with progress

### Widget Tests
- Screen rendering
- User interactions
- Navigation flows

---

## Conclusion

This mobile application provides comprehensive Docker management capabilities through a clean, intuitive Flutter interface. The architecture emphasizes:

1. **Separation of Concerns**: Services handle business logic, screens handle UI
2. **Real-time Updates**: Socket.IO for live data
3. **Multi-server Support**: Easy switching between Docker hosts
4. **Secure Authentication**: Device-based approval workflow
5. **Responsive Design**: Works across all platforms

The codebase is well-structured for maintenance and future enhancements, with clear patterns and consistent error handling throughout.

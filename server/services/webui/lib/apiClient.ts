// API Client Library for Container Control WebUI
// Centralized API calls matching mobile app functionality

const API_BASE = '';

export interface ApiError {
    error: string;
    message?: string;
}

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const error: ApiError = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || error.message || 'Request failed');
    }
    return response.json();
}

// Helper function to make authenticated requests
async function fetchApi<T>(
    endpoint: string,
    secretKey: string,
    options: RequestInit = {}
): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'x-secret-key': secretKey,
            ...options.headers,
        },
    });
    return handleResponse<T>(response);
}

// ============================================================================
// CONTAINER OPERATIONS
// ============================================================================

export interface Container {
    Id: string;
    Names: string[];
    Image: string;
    State: string;
    Status: string;
    Created: number;
    Ports?: any[];
    Labels?: Record<string, string>;
}

export interface ContainerInspect {
    Id: string;
    Name: string;
    State: {
        Status: string;
        Running: boolean;
        Paused: boolean;
        Restarting: boolean;
        StartedAt: string;
        FinishedAt: string;
    };
    Config: {
        Image: string;
        Env: string[];
        Cmd: string[];
        Labels: Record<string, string>;
    };
    HostConfig: {
        RestartPolicy: {
            Name: string;
            MaximumRetryCount: number;
        };
        Binds: string[];
        PortBindings: Record<string, any>;
    };
    NetworkSettings: {
        Networks: Record<string, any>;
    };
    Mounts: Array<{
        Type: string;
        Source: string;
        Destination: string;
        Mode: string;
        RW: boolean;
    }>;
}

export async function getContainers(secretKey: string): Promise<Container[]> {
    return fetchApi<Container[]>('/api/containers', secretKey);
}

export async function inspectContainer(id: string, secretKey: string): Promise<ContainerInspect> {
    return fetchApi<ContainerInspect>(`/api/containers/${id}`, secretKey);
}

export async function startContainer(id: string, secretKey: string): Promise<void> {
    return fetchApi<void>(`/api/containers/${id}/start`, secretKey, { method: 'POST' });
}

export async function stopContainer(id: string, secretKey: string): Promise<void> {
    return fetchApi<void>(`/api/containers/${id}/stop`, secretKey, { method: 'POST' });
}

export async function restartContainer(id: string, secretKey: string): Promise<void> {
    return fetchApi<void>(`/api/containers/${id}/restart`, secretKey, { method: 'POST' });
}

export async function deleteContainer(id: string, secretKey: string, force = true): Promise<void> {
    return fetchApi<void>(`/api/containers/${id}?force=${force}`, secretKey, { method: 'DELETE' });
}

export async function duplicateContainer(id: string, secretKey: string): Promise<any> {
    return fetchApi<any>(`/api/containers/${id}/duplicate`, secretKey, { method: 'POST' });
}

export async function recreateContainer(id: string, secretKey: string): Promise<any> {
    return fetchApi<any>(`/api/containers/${id}/recreate`, secretKey, { method: 'POST' });
}

export async function updateContainer(
    id: string,
    secretKey: string,
    config: { RestartPolicy?: { Name: string; MaximumRetryCount?: number } }
): Promise<void> {
    return fetchApi<void>(`/api/containers/${id}/update`, secretKey, {
        method: 'POST',
        body: JSON.stringify(config),
    });
}

export interface CreateContainerConfig {
    name?: string;
    Image: string;
    Env?: string[];
    Cmd?: string[];
    ExposedPorts?: Record<string, {}>;
    HostConfig?: {
        PortBindings?: Record<string, Array<{ HostPort: string }>>;
        Binds?: string[];
        RestartPolicy?: { Name: string; MaximumRetryCount?: number };
        NetworkMode?: string;
    };
    Labels?: Record<string, string>;
}

export async function createContainer(
    config: CreateContainerConfig,
    secretKey: string
): Promise<{ Id: string }> {
    return fetchApi<{ Id: string }>('/api/containers', secretKey, {
        method: 'POST',
        body: JSON.stringify(config),
    });
}

// ============================================================================
// IMAGE OPERATIONS
// ============================================================================

export interface Image {
    Id: string;
    RepoTags: string[];
    Size: number;
    Created: number;
}

export async function getImages(secretKey: string): Promise<Image[]> {
    return fetchApi<Image[]>('/api/images', secretKey);
}

export async function pullImage(image: string, secretKey: string): Promise<void> {
    return fetchApi<void>('/api/images/pull', secretKey, {
        method: 'POST',
        body: JSON.stringify({ image }),
    });
}

export async function deleteImage(id: string, secretKey: string, force = true): Promise<void> {
    return fetchApi<void>(`/api/images/${id}?force=${force}`, secretKey, { method: 'DELETE' });
}

export async function getPullingImages(secretKey: string): Promise<string[]> {
    return fetchApi<string[]>('/api/images/pulling', secretKey);
}

// Docker Hub API (proxied through gateway)
export interface DockerHubSearchResult {
    name: string;
    description: string;
    star_count: number;
    pull_count: number;
    is_official: boolean;
}

export async function searchDockerHub(query: string, secretKey: string): Promise<{ results: DockerHubSearchResult[] }> {
    return fetchApi<{ results: DockerHubSearchResult[] }>(
        `/api/dockerhub/search?query=${encodeURIComponent(query)}&page_size=10`,
        secretKey
    );
}

export async function getDockerHubTags(owner: string, repo: string, secretKey: string): Promise<{ results: Array<{ name: string }> }> {
    return fetchApi<{ results: Array<{ name: string }> }>(
        `/api/dockerhub/tags/${owner}/${repo}?page_size=20`,
        secretKey
    );
}

// ============================================================================
// VOLUME OPERATIONS
// ============================================================================

export interface Volume {
    Name: string;
    Driver: string;
    Mountpoint: string;
    CreatedAt: string;
    Labels: Record<string, string>;
}

export async function getVolumes(secretKey: string): Promise<{ Volumes: Volume[] }> {
    return fetchApi<{ Volumes: Volume[] }>('/api/volumes', secretKey);
}

export async function createVolume(
    name: string,
    secretKey: string,
    options?: {
        driver?: string;
        driverOpts?: Record<string, string>;
        labels?: Record<string, string>;
    }
): Promise<Volume> {
    return fetchApi<Volume>('/api/volumes', secretKey, {
        method: 'POST',
        body: JSON.stringify({
            Name: name,
            Driver: options?.driver || 'local',
            DriverOpts: options?.driverOpts || {},
            Labels: options?.labels || {},
        }),
    });
}

export async function deleteVolume(name: string, secretKey: string, force = true): Promise<void> {
    return fetchApi<void>(`/api/volumes/${name}?force=${force}`, secretKey, { method: 'DELETE' });
}

// ============================================================================
// NETWORK OPERATIONS
// ============================================================================

export interface Network {
    Id: string;
    Name: string;
    Driver: string;
    Scope: string;
    IPAM: {
        Config: Array<{ Subnet: string; Gateway: string }>;
    };
    Containers: Record<string, any>;
}

export async function getNetworks(secretKey: string): Promise<Network[]> {
    return fetchApi<Network[]>('/api/networks', secretKey);
}

export async function connectNetwork(
    networkId: string,
    containerId: string,
    secretKey: string
): Promise<void> {
    return fetchApi<void>(`/api/networks/${networkId}/connect`, secretKey, {
        method: 'POST',
        body: JSON.stringify({ Container: containerId }),
    });
}

export async function disconnectNetwork(
    networkId: string,
    containerId: string,
    secretKey: string
): Promise<void> {
    return fetchApi<void>(`/api/networks/${networkId}/disconnect`, secretKey, {
        method: 'POST',
        body: JSON.stringify({ Container: containerId }),
    });
}

// ============================================================================
// STACK OPERATIONS
// ============================================================================

export interface Stack {
    name: string;
    status: string;
    services: number;
}

export async function getStacks(secretKey: string): Promise<Stack[]> {
    return fetchApi<Stack[]>('/api/stacks', secretKey);
}

export async function createStack(name: string, content: string, secretKey: string): Promise<void> {
    return fetchApi<void>('/api/stacks', secretKey, {
        method: 'POST',
        body: JSON.stringify({ name, content }),
    });
}

export async function upStack(name: string, secretKey: string): Promise<void> {
    return fetchApi<void>(`/api/stacks/${name}/up`, secretKey, { method: 'POST' });
}

export async function downStack(name: string, secretKey: string): Promise<void> {
    return fetchApi<void>(`/api/stacks/${name}/down`, secretKey, { method: 'POST' });
}

export async function controlStack(name: string, action: 'start' | 'stop' | 'restart', secretKey: string): Promise<void> {
    return fetchApi<void>(`/api/stacks/${name}/${action}`, secretKey, { method: 'POST' });
}

// ============================================================================
// SYSTEM OPERATIONS
// ============================================================================

export interface SystemInfo {
    ID: string;
    Containers: number;
    ContainersRunning: number;
    ContainersPaused: number;
    ContainersStopped: number;
    Images: number;
    Driver: string;
    DriverStatus: Array<[string, string]>;
    SystemStatus: Array<[string, string]> | null;
    Plugins: {
        Volume: string[];
        Network: string[];
        Authorization: string[] | null;
        Log: string[];
    };
    MemoryLimit: boolean;
    SwapLimit: boolean;
    KernelMemory: boolean;
    CpuCfsPeriod: boolean;
    CpuCfsQuota: boolean;
    CPUShares: boolean;
    CPUSet: boolean;
    IPv4Forwarding: boolean;
    BridgeNfIptables: boolean;
    BridgeNfIp6tables: boolean;
    Debug: boolean;
    NFd: number;
    OomKillDisable: boolean;
    NGoroutines: number;
    SystemTime: string;
    LoggingDriver: string;
    CgroupDriver: string;
    NEventsListener: number;
    KernelVersion: string;
    OperatingSystem: string;
    OSType: string;
    Architecture: string;
    IndexServerAddress: string;
    RegistryConfig: any;
    NCPU: number;
    MemTotal: number;
    GenericResources: any[] | null;
    DockerRootDir: string;
    HttpProxy: string;
    HttpsProxy: string;
    NoProxy: string;
    Name: string;
    Labels: string[];
    ExperimentalBuild: boolean;
    ServerVersion: string;
    ClusterStore: string;
    ClusterAdvertise: string;
    Runtimes: Record<string, any>;
    DefaultRuntime: string;
    Swarm: any;
    LiveRestoreEnabled: boolean;
    Isolation: string;
    InitBinary: string;
    ContainerdCommit: any;
    RuncCommit: any;
    InitCommit: any;
    SecurityOptions: string[];
}

export async function getSystemInfo(secretKey: string): Promise<SystemInfo> {
    return fetchApi<SystemInfo>('/api/system/info', secretKey);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return bytes + ' B';
}

export function formatNumber(num: number): string {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

export function getContainerState(state: string): {
    color: string;
    label: string;
} {
    switch (state.toLowerCase()) {
        case 'running':
            return { color: 'text-green-500', label: 'Running' };
        case 'exited':
            return { color: 'text-gray-500', label: 'Stopped' };
        case 'paused':
            return { color: 'text-yellow-500', label: 'Paused' };
        case 'restarting':
            return { color: 'text-blue-500', label: 'Restarting' };
        case 'dead':
            return { color: 'text-red-500', label: 'Dead' };
        default:
            return { color: 'text-gray-400', label: state };
    }
}

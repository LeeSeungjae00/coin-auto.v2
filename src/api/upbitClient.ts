import axios from 'axios';

const upbitAPIClient = axios.create();

upbitAPIClient.defaults.baseURL = process.env.UPBIT_OPEN_API_SERVER_URL;
upbitAPIClient.defaults.headers.common.Accept = 'application/json';

export default upbitAPIClient;

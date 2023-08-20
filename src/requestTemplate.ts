import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import _ from "lodash-es";

class Http {
  baseURL: string;
  timeout: number;
  token: string;
  constructor() {
    this.baseURL = "/";
    this.timeout = 0;
    this.token = "";
  }
  setInterceptor(instance: AxiosInstance): void {
    instance.interceptors.request.use(
      async (config: AxiosRequestConfig) => {
        //todo Token
        const token = "";
        config.headers["Authorization"] = token || "Bearer";
        return config;
      },
      (error: any) => error
    );
    instance.interceptors.response.use(
      (res: AxiosResponse) => {
        const isNormal = res.data?.code >= 200 && res.data?.code < 300;
        const isDownload = _.has(res.headers, "content-disposition");
        const isHttpStatus = res.status >= 200 && res.status < 300;
        // 下载情况
        if (isHttpStatus && isDownload) {
          return [undefined, res.data, res];
        }
        // 有code并且code不在200-300之间为异常
        if (_.has(res.data, "code") && !isNormal) {
          ElMessage.error(res?.data?.message || "");
          return [res.data, undefined];
        }
        // 其他情况均为正常
        return [undefined, res.data];
      },
      (error: any) => {
        if (
          error?.response?.data instanceof Blob &&
          error.response.data.type.toLowerCase().indexOf("json") !== -1
        ) {
          const reader = new FileReader();
          reader.readAsText(error.response.data, "utf-8");
          reader.onload = function (e) {
            const errorMsg = JSON.parse(reader.result as string).message;
            ElMessage.error(errorMsg);
          };
        } else {
          let code = 0;
          try {
            code = error.response.data.status || error.response.data.code;
          } catch (e) {
            if (error.toString().indexOf("Error: timeout") !== -1) {
              ElNotification.error({
                title: "网络请求超时",
                duration: 5000,
              });
              return [error, undefined];
            }
          }
          if (code) {
            if (code === 401) {
              useUserStore()
                .logOut()
                .then(() => {
                  // todo 用户登录界面提示
                  Cookies.set("point", 401);
                  location.reload();
                });
            } else if (code === 403) {
              router.push({ path: "/401" });
            } else {
              const errorMsg = error.response.data.message;
              if (errorMsg !== undefined) {
                ElMessage.error(errorMsg);
              }
            }
          } else if (error?.message === "cancel") {
            // console.log('请求取消')
          } else {
            console.log("-> error", error);
            ElNotification.error({
              title: "接口请求失败",
              duration: 5000,
            });
          }
        }
        return [error, undefined];
      }
    );
  }
  mergeOptions(options: AxiosRequestConfig): AxiosRequestConfig {
    return {
      baseURL: this.baseURL,
      timeout: this.timeout,
      ...options,
    };
  }
  request(options: AxiosRequestConfig): Promise<AxiosResponse> {
    const instance = axios.create();
    const opts = this.mergeOptions(options);
    this.setInterceptor(instance);
    return instance(opts);
  }
  get(config: AxiosRequestConfig = {}): Promise<AxiosResponse> {
    return this.request({
      method: "get",
      ...config,
    });
  }
  post(config: AxiosRequestConfig = {}): Promise<AxiosResponse> {
    return this.request({
      method: "post",
      ...config,
    });
  }
  put(config: AxiosRequestConfig = {}): Promise<AxiosResponse> {
    return this.request({
      method: "put",
      ...config,
    });
  }
  del(config: AxiosRequestConfig = {}): Promise<AxiosResponse> {
    return this.request({
      method: "DELETE",
      ...config,
    });
  }
  delete(config: AxiosRequestConfig = {}): Promise<AxiosResponse> {
    return this.request({
      method: "DELETE",
      ...config,
    });
  }
  patch(config: AxiosRequestConfig = {}): Promise<AxiosResponse> {
    return this.request({
      method: "PATCH",
      ...config,
    });
  }
}
export default new Http();

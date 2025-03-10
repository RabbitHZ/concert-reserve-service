import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
      { duration: "5s",  target: 1000 },
      { duration: "15s", target: 1000 },
      { duration: "10s", target: 700 },
      { duration: "10s", target: 500 },
      { duration: "10s", target: 100 },
      { duration: "10s", target: 0 },
  ],
};

export default function () {
  //const url = "http://localhost:8080/api/v1/queues";
  const url = "http://host.docker.internal:8080/api/v1/queues";

  // 1 ~ 20 범위에서 랜덤한 userId 선택
  const userId = Math.floor(Math.random() * (20 - 1 + 1)) + 1;

  const payload = JSON.stringify({
    userId: userId,
  });

  const params = {
    headers: { "Content-Type": "application/json" },
  };

  const res = http.post(url, payload, params);

  // 응답 상태 체크
  check(res, {
   "POST status is 200": (r) => r.status === 200,
  });

  // 응답 헤더에서 Queue-Token-Queue-Id 추출
  const tokenQueueId = res.headers["Queue-Token-Queue-Id"];

  if (tokenQueueId) {
    const verifyUrl = `${url}`;
    const verifyParams = {
    headers: {
       "Content-Type": "application/json",
       "Queue-Token-Queue-Id": tokenQueueId,
     },
    };

   // 2) 검증 엔드포인트 호출
   const verifyRes = http.get(verifyUrl, verifyParams);

 }

 sleep(1); // 부하 분산을 위해 잠시 대기
}

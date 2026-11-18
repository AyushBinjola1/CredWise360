FROM debian:bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends cmake ninja-build g++ libpq-dev libssl-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY CMakeLists.txt .
COPY services/core services/core
RUN cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release && cmake --build build --parallel 2 && ctest --test-dir build --output-on-failure
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 libssl3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /src/build/services/core/credwise /usr/local/bin/credwise
COPY database database
USER 65534:65534
ENV CORE_HOST=0.0.0.0
ENTRYPOINT ["credwise"]

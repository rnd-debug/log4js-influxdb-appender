export interface InfluxAppender {
  type: '@log4js-node/log4js-influxdb-appender';
  // hostname or IP-address of the target server
  host?: string;
  // name of the target database
  database?: string;
  // user name
  username?: string;
  // user password
  password?: string;
  // name of the target measurement
  measurement?: string;
  //
  fields?: string;
  //
  tags?: string;
  // number of LoggingEvent to buffer before sending them to InfluxDB
  maxBatchSize?: number;
  // used to transform the LoggingEvent
  // check `Layout` documentation of log4js
  layout?: object;
}

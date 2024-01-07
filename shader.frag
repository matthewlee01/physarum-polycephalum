precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_grid;

uniform float u_temperature;
uniform float u_wind;
uniform float u_pressure;
uniform float u_humidity;

varying vec2 vTexCoord;

void main() {
    vec2 tex_coord = vec2(vTexCoord.x, 1.0-vTexCoord.y);
    vec2 tex_offset = 1.0 / u_resolution;

    vec4 color = texture2D(u_grid, tex_coord);

    float threshold = u_pressure / 4.0 + 0.25; 

    if (color.r > threshold && color.g > threshold && color.b > threshold) {

        float count = 1.0;
        const int radius = 2;
        for (int i = 1; i < radius; i++) {
            for (int j = 1; j < radius; j++) {
                count += 4.0;
                float dx = float(i) * tex_offset.x * (12.0 - u_humidity*8.0);
                float dy = float(j) * tex_offset.y * (12.0 - u_humidity*8.0);
                color += texture2D(u_grid, vec2(dx, dy)+tex_coord);
                color += texture2D(u_grid, vec2(dx, -dy)+tex_coord);
                color += texture2D(u_grid, vec2(-dx, dy)+tex_coord);
                color += texture2D(u_grid, vec2(-dx, -dy)+tex_coord);
            }
        }
        color = color/count;
    }
    // color.a -= 0.4/(1.0+u_humidity);
    float wind_flow = 0.1 * u_wind * u_time;
    vec2 p1 = vec2(
        0.5 + 0.5*sin(wind_flow*1.2),
        0.5 + 0.5*sin(wind_flow*0.4)
    );
    vec2 p2 = vec2(
        0.5 - 0.5*sin(wind_flow),
        0.5 - 0.5*sin(wind_flow*0.8)
    );
    vec2 p3 = vec2(
        0.5 + 0.5*sin(wind_flow),
        0.5 - 0.5*sin(wind_flow*1.6)
    );
    color.a += -0.2*u_humidity + 0.2 * sin(
        distance(p2, tex_coord)-distance(p1, tex_coord)-distance(p3, tex_coord)
    );
    color.r += 0.4 * u_temperature;
    color.g += 0.25;
    color.b += 0.4 * (1.0 - u_temperature);
    gl_FragColor = color;
}
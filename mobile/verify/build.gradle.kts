plugins {
    kotlin("jvm") version "1.9.24"
}

repositories {
    mavenCentral()
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}
tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
    kotlinOptions.jvmTarget = "17"
}

sourceSets {
    main {
        kotlin.srcDirs(
            "../app/src/main/java/com/remotedesktop/input",
            "../app/src/main/java/com/remotedesktop/signaling"
        )
        kotlin.exclude("**/SignalingClient.kt")
        kotlin.exclude("**/AndroidKeyMapper.kt")
    }
    test {
        kotlin.srcDirs(
            "../app/src/test/java/com/remotedesktop/input",
            "../app/src/test/java/com/remotedesktop/signaling"
        )
    }
}

dependencies {
    implementation("org.json:json:20240303")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
}

tasks.test {
    useJUnit()
    testLogging {
        events("passed", "failed", "skipped")
        showStandardStreams = true
    }
}

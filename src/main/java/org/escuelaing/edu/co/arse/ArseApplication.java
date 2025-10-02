package org.escuelaing.edu.co.arse;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
@RestController
public class ArseApplication {

	public static void main(String[] args) {

		SpringApplication.run(ArseApplication.class, args);
	}

	@GetMapping("/status")
	public String status() {
		return "{\"status\":\"Greetings from Spring Boot. " +
				java.time.LocalDate.now() + ", " +
				java.time.LocalTime.now() +
				". " + "The server is Runnig!\"}";
	}
}
